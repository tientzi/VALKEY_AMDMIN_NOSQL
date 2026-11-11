require('dotenv').config();
const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const path = require('path');
const { createClient } = require('redis');
const firebaseAdmin = require('./firebaseAdmin');
const multer = require('multer');
const upload = multer({storage:multer.diskStorage({destination:path.join(__dirname,'..','uploads'),filename:(req,file,cb)=>cb(null,crypto.randomUUID()+({ 'image/png':'.png','image/jpeg':'.jpg','image/webp':'.webp'}[file.mimetype]||'.bin'))}),limits:{fileSize:5*1024*1024,files:10},fileFilter:(req,file,cb)=>cb(null,['image/png','image/jpeg','image/webp'].includes(file.mimetype))});

const app = express();
const port = Number(process.env.PORT || 3000);
const paymentTtl = Number(process.env.PAYMENT_TTL_SECONDS || 30);
const redis = createClient({ url: process.env.VALKEY_URL || 'redis://localhost:6379' });
redis.on('error', err => console.error('Valkey:', err.message));

app.use(cors());
app.use(express.json({ limit: '4mb' }));
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

// Mọi thao tác ghi từ giao diện được phát ngay qua Pub/Sub và lưu vào Stream.
// Nhờ đó dữ liệu trong Valkey và màn hình giám sát luôn có dấu vết thời gian thực.
app.use((req, res, next) => {
  res.on('finish', () => {
    if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method) || res.statusCode >= 400 || !redis.isReady) return;
    const event = JSON.stringify({ method: req.method, path: req.originalUrl, status: res.statusCode, timestamp: now() });
    Promise.all([
      redis.publish('mm:realtime:changes', event),
      redis.xAdd('mm:realtime:events', '*', { event }),
    ]).then(() => redis.xTrim('mm:realtime:events', 'MAXLEN', 500)).catch(err => console.error('Realtime:', err.message));
  });
  next();
});

const now = () => new Date().toISOString();
const num = value => Number.isFinite(Number(value)) ? Number(value) : 0;
const bool = value => value === true || value === 'true' || value === '1';
const json = (value, fallback = []) => { try { return JSON.parse(value); } catch { return fallback; } };
const validPhone = value => /^0\d{9}$/.test(String(value || '').trim());
const TIER_RULES = {
  BRONZE: { minPoints: 0, discount: 0, label: 'Đồng', benefits: ['Tích điểm cho mọi đơn hàng'] },
  SILVER: { minPoints: 500, discount: 2, label: 'Bạc', benefits: ['Giảm tự động 2% mọi đơn'] },
  GOLD: { minPoints: 1000, discount: 5, label: 'Vàng', benefits: ['Giảm tự động 5% mọi đơn'] },
  DIAMOND: { minPoints: 2000, discount: 8, label: 'Kim Cương', benefits: ['Giảm tự động 8% mọi đơn', 'Ưu tiên hỗ trợ'] },
};
const tierForPoints = points => points >= 2000 ? 'DIAMOND' : points >= 1000 ? 'GOLD' : points >= 500 ? 'SILVER' : 'BRONZE';
const hashPassword = (password, salt = crypto.randomBytes(16).toString('hex')) => `${salt}:${crypto.pbkdf2Sync(String(password), salt, 120000, 32, 'sha256').toString('hex')}`;
const verifyPassword = (password, stored) => { const [salt] = String(stored || '').split(':'); return !!salt && hashPassword(password, salt) === stored; };
const token = () => crypto.randomBytes(32).toString('hex');
const roleOut = role => role === 'admin' ? 'ROLE_ADMIN' : role === 'shipper' ? 'ROLE_SHIPPER' : 'ROLE_USER';
const roleIn = role => String(role || '').replace('ROLE_', '').toLowerCase();
// One application instance serializes business mutations and worker ticks.
let mutationQueue = Promise.resolve();
const serialized = fn => { const result = mutationQueue.then(fn); mutationQueue = result.catch(()=>{}); return result; };
const asyncRoute = fn => (req, res, next) => (req.method === 'GET' ? Promise.resolve().then(()=>fn(req,res,next)) : serialized(()=>fn(req,res,next))).catch(next);
const error = (message, status = 400) => Object.assign(new Error(message), { status });

async function getHash(key) { const value = await redis.hGetAll(key); return value && Object.keys(value).length ? value : null; }
async function getJsonList(setKey, prefix) {
  const ids = await redis.sMembers(setKey); const rows = [];
  for (const id of ids) { const row = await getHash(`${prefix}:${id}`); if (row) {if(prefix==='coupon')row.applicableCategoryName=num(row.applicableCategoryId)>0?(await getHash(`category:${row.applicableCategoryId}`))?.name||'Danh mục đã xóa':null;rows.push(row);} }
  return rows.sort((a, b) => num(a.id) - num(b.id));
}
async function validateCoupon(data,id){
 data.code=String(data.code||'').trim().toUpperCase();
 if(!data.code||!['PERCENTAGE','FIXED_AMOUNT','FIXED','PERCENT'].includes(data.discountType))throw error('Mã hoặc loại voucher không hợp lệ');
 if(!(Number(data.discountValue)>0)||(['PERCENTAGE','PERCENT'].includes(data.discountType)&&Number(data.discountValue)>100))throw error('Giá trị giảm không hợp lệ');
 for(const key of ['minOrderAmount','maxDiscountAmount','maxUses'])if(data[key]!=null&&data[key]!==''&&(!Number.isFinite(Number(data[key]))||Number(data[key])<0))throw error('Giá trị voucher không được âm');
 if(!Number.isFinite(Date.parse(data.startDate))||!Number.isFinite(Date.parse(data.endDate))||Date.parse(data.endDate)<Date.parse(data.startDate))throw error('Thời gian voucher không hợp lệ');
 if(num(data.applicableCategoryId)>0&&!await getHash(`category:${data.applicableCategoryId}`))throw error('Danh mục không tồn tại');
 for(const row of await getJsonList('coupon:ids','coupon'))if(row.code===data.code&&String(row.id)!==String(id||''))throw error('Mã voucher đã tồn tại');
 delete data.usedCount;
}
async function saveEntity(type, data, id = null) {
  const entityId = String(id || await redis.incr(`${type}:id`));
  const value = { ...data, id: entityId, updatedAt: now() };
  if (!id) value.createdAt = value.updatedAt;
  await redis.hSet(`${type}:${entityId}`, Object.fromEntries(Object.entries(value).map(([k,v]) => [k, v == null ? '' : typeof v === 'object' ? JSON.stringify(v) : String(v ?? '')])));
  await redis.sAdd(`${type}:ids`, entityId);
  return getHash(`${type}:${entityId}`);
}
async function addLog(level, message, extra = {}) {
  await redis.xAdd('mm:activity:logs', '*', { level, message, timestamp: now(), ...Object.fromEntries(Object.entries(extra).map(([k,v]) => [k, String(v)])) });
  await redis.xTrim('mm:activity:logs', 'MAXLEN', 100);
}
async function readLogs(count = 50) {
  const rows = await redis.xRevRange('mm:activity:logs', '+', '-', { COUNT: count });
  return rows.map(x => x.message);
}

function publicUser(user) {
  return { id: num(user.id), username: user.username, email: user.email, fullName: user.fullName, phone: user.phone || '', avatar: user.avatar || '', authProvider: user.authProvider || 'password', role: roleOut(user.role), isActive: bool(user.isActive), loyaltyPoints: num(user.loyaltyPoints), membershipTier: tierForPoints(num(user.loyaltyPoints)), createdAt: user.createdAt };
}
async function findUser(login) {
  const key = String(login || '').toLowerCase();
  const id = await redis.get(`username:${key}`) || await redis.get(`email:${key}`);
  return id ? getHash(`user:${id}`) : null;
}
async function createUser(data) {
  const username = String(data.username || '').trim().toLowerCase();
  const email = String(data.email || '').trim().toLowerCase();
  if (!username || username.length < 4) throw error('Tên đăng nhập phải có ít nhất 4 ký tự');
  if (!/^\S+@\S+\.\S+$/.test(email)) throw error('Email không hợp lệ');
  if (String(data.password || '').length < 6) throw error('Mật khẩu phải có ít nhất 6 ký tự');
  if (data.phone && !validPhone(data.phone)) throw error('Số điện thoại phải có 10 chữ số và bắt đầu bằng số 0');
  if (await redis.get(`username:${username}`)) throw error('Username đã được sử dụng', 409);
  if (await redis.get(`email:${email}`)) throw error('Email đã được sử dụng', 409);
  const row = await saveEntity('user', { username, email, fullName: data.fullName || data.full_name || username, phone: data.phone || '', role: roleIn(data.role) || 'user', isActive: true, loyaltyPoints: data.loyaltyPoints || 0, membershipTier: data.membershipTier || 'BRONZE', passwordHash: hashPassword(data.password) });
  await redis.set(`username:${username}`, row.id); await redis.set(`email:${email}`, row.id); await redis.sAdd(`users:role:${row.role}`, row.id);
  return row;
}
async function auth(req, res, next) {
  try {
    const bearer = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
    const session = bearer && await getHash(`session:${bearer}`);
    if (!session) throw error('Vui lòng đăng nhập', 401);
    const user = await getHash(`user:${session.userId}`);
    if (!user || !bool(user.isActive)) throw error('Tài khoản không khả dụng', 401);
    req.user = user; req.token = bearer; next();
  } catch (e) { next(e); }
}
const requireRole = (...roles) => (req, res, next) => roles.includes(req.user.role) ? next() : next(error('Bạn không có quyền thực hiện thao tác này', 403));

function productDto(p) {
  return { id:num(p.id), name:p.name, description:p.description || '', price:num(p.price), salePrice:p.salePrice ? num(p.salePrice) : null, categoryId:num(p.categoryId), categoryName:p.categoryName, brandId:num(p.brandId), brandName:p.brandName, mainImage:p.mainImage || '', images:json(p.images), currentStock:num(p.currentStock), minimumStock:num(p.minimumStock || 5), unit:p.unit || 'Cái', sku:p.sku || `SP${p.id}`, barcode:p.barcode || '', location:p.location || '', isActive:bool(p.isActive), averageRating:num(p.averageRating), reviewCount:num(p.reviewCount) };
}
async function allProducts() { return (await getJsonList('product:ids','product')).map(productDto); }
async function cartDto(userId) {
  const quantities = await redis.hGetAll(`cart:${userId}`); const items=[];
  for (const [productId, quantityRaw] of Object.entries(quantities)) {
    const p = await getHash(`product:${productId}`); if (!p) continue; const quantity=num(quantityRaw);
    items.push({ id:num(productId), productId:num(productId), productName:p.name, productImage:p.mainImage, productMainImage:p.mainImage, productPrice:num(p.price), productSalePrice:p.salePrice?num(p.salePrice):null, categoryId:num(p.categoryId), categoryName:p.categoryName, quantity, currentStock:num(p.currentStock), maxStock:num(p.currentStock) });
  }
  return { id:num(userId), items };
}
function orderDto(o) {
  return { id:num(o.id), userId:num(o.userId), customerName:o.customerName, shippingName:o.shippingName, shippingPhone:o.shippingPhone, shippingAddress:o.shippingAddress, paymentMethod:o.paymentMethod, paymentStatus:o.paymentStatus, status:o.status, totalAmount:num(o.totalAmount), couponDiscount:num(o.couponDiscount), membershipDiscount:num(o.membershipDiscount), membershipTier:o.membershipTier||'BRONZE', discountAmount:num(o.discountAmount), finalAmount:num(o.finalAmount), couponCode:o.couponCode || null, transferContent:o.transferContent||'', note:o.note || '', jobId:o.jobId, shipperId:o.shipperId?num(o.shipperId):null, shipperName:o.shipperName || null, items:json(o.items), createdAt:o.createdAt, updatedAt:o.updatedAt };
}
async function getOrder(id) { const o=await getHash(`order:${id}`); return o?orderDto(o):null; }
async function listOrders(ids = null) { const source=ids || await redis.sMembers('order:ids'); const rows=[]; for(const id of source){const o=await getOrder(id); if(o)rows.push(o);} return rows.sort((a,b)=>b.id-a.id); }
async function calculateCoupon(code, amount, items) {
  if (!code) return { discount: 0, coupon: null };
  const ids = await redis.sMembers('coupon:ids'); let coupon = null;
  for (const id of ids) { const row = await getHash(`coupon:${id}`); if (row && row.code === String(code).trim().toUpperCase()) { coupon = row; break; } }
  if (!coupon || !bool(coupon.isActive)) throw error('Mã giảm giá không hợp lệ');
  const time = Date.now();
  if (coupon.startDate && new Date(coupon.startDate).getTime() > time) throw error('Mã giảm giá chưa đến thời gian áp dụng');
  if (coupon.endDate && new Date(coupon.endDate).getTime() < time) throw error('Mã giảm giá đã hết hạn');
  if (amount < num(coupon.minOrderAmount)) throw error('Đơn hàng chưa đạt giá trị tối thiểu của voucher');
  if (num(coupon.maxUses) > 0 && num(coupon.usedCount) >= num(coupon.maxUses)) throw error('Voucher đã hết lượt sử dụng');
  let eligible = amount;
  if (num(coupon.applicableCategoryId)>0) { eligible = items.filter(i => String(i.categoryId) === String(coupon.applicableCategoryId)).reduce((s,i)=>s+i.price*i.quantity,0); if (!eligible) throw error('Voucher không áp dụng cho sản phẩm trong giỏ'); }
  let discount = ['FIXED','FIXED_AMOUNT'].includes(coupon.discountType) ? num(coupon.discountValue) : eligible * num(coupon.discountValue) / 100;
  if (num(coupon.maxDiscountAmount) > 0) discount = Math.min(discount, num(coupon.maxDiscountAmount));
  return { discount: Math.min(eligible, amount, Math.round(discount)), coupon };
}

async function bestCoupon(amount,items){let best={discount:0,coupon:null};for(const row of await getJsonList('coupon:ids','coupon')){try{const result=await calculateCoupon(row.code,amount,items);if(result.discount>best.discount)best=result;}catch(e){if(e.status!==400)throw e;}}return best;}
app.get('/api/cart/quote',auth,asyncRoute(async(req,res)=>{const cart=await cartDto(req.user.id),items=cart.items.map(x=>({...x,price:x.productSalePrice??x.productPrice})),total=items.reduce((sum,x)=>sum+x.price*x.quantity,0),best=await bestCoupon(total,items),tier=tierForPoints(num(req.user.loyaltyPoints)),membershipDiscount=Math.round(total*TIER_RULES[tier].discount/100);res.json({couponCode:best.coupon?.code||'',couponDiscount:best.discount,membershipTier:tier,membershipDiscount,finalAmount:Math.max(0,total-best.discount-membershipDiscount)});}));
app.get('/api/health', asyncRoute(async(req,res)=>res.json({status:'ok',database:'Valkey NoSQL',sql:false})));
app.post('/api/auth/register', asyncRoute(async(req,res)=>{ await createUser({...req.body,role:'user'}); res.status(201).json({message:'Đăng ký thành công'}); }));
app.post('/api/auth/login', asyncRoute(async(req,res)=>{ const user=await findUser(req.body.usernameOrEmail); if(!user||!verifyPassword(req.body.password,user.passwordHash)||!bool(user.isActive)) throw error('Tên đăng nhập hoặc mật khẩu không đúng',401); const accessToken=token(); await redis.hSet(`session:${accessToken}`,{userId:user.id,createdAt:now()}); await redis.expire(`session:${accessToken}`,req.body.rememberMe?604800:86400); res.json({accessToken,...publicUser(user)}); }));
app.post('/api/auth/google', asyncRoute(async(req,res)=>{
  if(!req.body.idToken)throw error('Thiếu Firebase ID Token',400);
  const decoded=await firebaseAdmin.getAuth().verifyIdToken(req.body.idToken);
  if(!decoded.email||decoded.email_verified!==true)throw error('Email Google chưa được xác minh',401);
  const email=decoded.email.toLowerCase();let user=await findUser(email);
  if(!user){let base=String(email.split('@')[0]).replace(/[^a-z0-9]/g,'').slice(0,20)||'googleuser';let username=base,index=1;while(await redis.get(`username:${username}`))username=`${base}${index++}`;user=await createUser({username,email,password:crypto.randomBytes(32).toString('hex'),fullName:decoded.name||username,role:'user'});}
  if(!bool(user.isActive))throw error('Tài khoản đã bị khóa',403);
  await redis.hSet(`user:${user.id}`,{firebaseUid:decoded.uid,avatar:decoded.picture||'',authProvider:'google',emailVerified:'true',updatedAt:now()});
  user=await getHash(`user:${user.id}`);const accessToken=token();await redis.hSet(`session:${accessToken}`,{userId:user.id,loginMethod:'google',firebaseUid:decoded.uid,createdAt:now()});await redis.expire(`session:${accessToken}`,86400);
  await addLog('SUCCESS',`Đăng nhập Google: ${email}`,{userId:user.id});res.json({accessToken,...publicUser(user)});
}));
app.post('/api/auth/forgot-password',asyncRoute(async(req,res)=>{throw error('Chức năng khôi phục mật khẩu cần xác minh email. Vui lòng liên hệ quản trị viên; tài khoản Google dùng khôi phục tài khoản Google.',400);}));

app.get('/api/public/products', asyncRoute(async(req,res)=>{ let rows=(await allProducts()).filter(x=>x.isActive); const q=String(req.query.keyword||'').toLowerCase(); if(q)rows=rows.filter(x=>`${x.name} ${x.categoryName} ${x.brandName}`.toLowerCase().includes(q)); if(req.query.categoryId)rows=rows.filter(x=>String(x.categoryId)===String(req.query.categoryId)); if(req.query.brandId)rows=rows.filter(x=>String(x.brandId)===String(req.query.brandId)); if(req.query.minPrice)rows=rows.filter(x=>(x.salePrice??x.price)>=num(req.query.minPrice)); if(req.query.maxPrice)rows=rows.filter(x=>(x.salePrice??x.price)<=num(req.query.maxPrice)); if(req.query.sortBy==='price_asc')rows.sort((a,b)=>(a.salePrice??a.price)-(b.salePrice??b.price)); else if(req.query.sortBy==='price_desc')rows.sort((a,b)=>(b.salePrice??b.price)-(a.salePrice??a.price)); else rows.sort((a,b)=>b.id-a.id); res.json(rows); }));
app.get('/api/public/products/:id', asyncRoute(async(req,res)=>{const p=await getHash(`product:${req.params.id}`);if(!p)throw error('Không tìm thấy sản phẩm',404);res.json(productDto(p));}));
app.get('/api/public/products/:id/recommendations', asyncRoute(async(req,res)=>res.json((await allProducts()).filter(x=>x.id!==num(req.params.id)).slice(0,num(req.query.limit)||4))));
app.get('/api/public/categories', asyncRoute(async(req,res)=>res.json((await getJsonList('category:ids','category')).map(x=>({...x,id:num(x.id),isActive:bool(x.isActive)})))));
app.get('/api/public/brands', asyncRoute(async(req,res)=>res.json((await getJsonList('brand:ids','brand')).map(x=>({...x,id:num(x.id),isActive:bool(x.isActive)})))));
app.get('/api/public/coupons', asyncRoute(async(req,res)=>res.json((await getJsonList('coupon:ids','coupon')).map(x=>({...x,id:num(x.id),discountValue:num(x.discountValue),minOrderAmount:num(x.minOrderAmount),maxDiscountAmount:num(x.maxDiscountAmount),maxUses:num(x.maxUses),usedCount:num(x.usedCount),applicableCategoryId:x.applicableCategoryId?num(x.applicableCategoryId):null,isActive:bool(x.isActive)})).filter(x=>x.isActive))));
app.get('/api/public/payment-methods', asyncRoute(async(req,res)=>res.json((await getJsonList('payment_method:ids','payment_method')).map(x=>({...x,id:num(x.id),isEnabled:bool(x.isEnabled)})))));
app.post('/api/public/coupons/apply',auth,asyncRoute(async(req,res)=>{const cart=await cartDto(req.user.id);const items=cart.items.map(x=>({...x,price:x.productSalePrice??x.productPrice}));const amount=items.reduce((n,x)=>n+x.price*x.quantity,0);const result=await calculateCoupon(req.body.code,amount,items);res.json({code:result.coupon?.code||'',discountAmount:result.discount});}));
app.post('/api/public/chat', asyncRoute(async(req,res)=>{const q=String(req.body.message||'').trim().toLowerCase();let response='Mình có thể giúp bạn tìm sản phẩm, kiểm tra tồn kho, voucher, hạng thành viên và cách thanh toán.';if(!q)throw error('Vui lòng nhập câu hỏi');if(q.includes('voucher')||q.includes('mã giảm'))response='Bạn mở mục Thành viên để xem voucher. Voucher theo danh mục chỉ giảm trên các sản phẩm thuộc đúng danh mục.';else if(q.includes('thành viên')||q.includes('hạng'))response='Hạng Bạc giảm 2%, Vàng giảm 5%, Kim Cương giảm 8% tự động khi thanh toán.';else if(q.includes('thanh toán')||q.includes('qr'))response='Khi đặt đơn chuyển khoản, hệ thống tạo VietQR đúng ngân hàng, số tiền và nội dung theo mã đơn.';else if(q.includes('kho')||q.includes('còn')){const products=await allProducts();const hit=products.find(p=>q.includes(p.name.toLowerCase()));response=hit?`${hit.name} hiện còn ${hit.currentStock} ${hit.unit} trong kho.`:'Bạn vào trang sản phẩm hoặc giỏ hàng để xem số lượng tồn kho hiện tại.';}else if(q.includes('xin chào')||q.includes('hello'))response='Xin chào! Mình là trợ lý MiniMart. Bạn muốn tìm sản phẩm, voucher hay kiểm tra đơn hàng?';res.json({response,reply:response});}));

app.get('/api/cart',auth,asyncRoute(async(req,res)=>res.json(await cartDto(req.user.id))));
app.post('/api/cart/add',auth,asyncRoute(async(req,res)=>{const p=await getHash(`product:${req.body.productId}`);if(!p||!bool(p.isActive))throw error('Sản phẩm không khả dụng');const old=num(await redis.hGet(`cart:${req.user.id}`,String(req.body.productId)));const amount=num(req.body.quantity);if(!Number.isInteger(amount)||amount<1)throw error('Số lượng phải là số nguyên dương');const qty=old+amount;const allowExceed=bool(req.body.allowExceedStock)||bool(req.query.allowExceedStock)||req.headers['x-allow-exceed-stock']==='true';if(qty>num(p.currentStock)&&!allowExceed)throw error('Số lượng vượt quá tồn kho');await redis.hSet(`cart:${req.user.id}`,String(req.body.productId),String(qty));res.json(await cartDto(req.user.id));}));
app.put('/api/cart/update',auth,asyncRoute(async(req,res)=>{const p=await getHash(`product:${req.body.productId}`);const qty=num(req.body.quantity);const allowExceed=bool(req.body.allowExceedStock)||bool(req.query.allowExceedStock)||req.headers['x-allow-exceed-stock']==='true';if(!p||!Number.isInteger(qty)||qty<1||(qty>num(p.currentStock)&&!allowExceed))throw error('Số lượng không hợp lệ');await redis.hSet(`cart:${req.user.id}`,String(req.body.productId),String(qty));res.json(await cartDto(req.user.id));}));
app.delete('/api/cart/remove/:id',auth,asyncRoute(async(req,res)=>{await redis.hDel(`cart:${req.user.id}`,req.params.id);res.json(await cartDto(req.user.id));}));

app.get('/api/addresses',auth,asyncRoute(async(req,res)=>{const ids=await redis.sMembers(`user:${req.user.id}:addresses`);const rows=[];for(const id of ids){const x=await getHash(`address:${id}`);if(x)rows.push({...x,id:num(x.id),isDefault:bool(x.isDefault)});}res.json(rows);}));
app.post('/api/addresses',auth,asyncRoute(async(req,res)=>{if(!validPhone(req.body.receiverPhone))throw error('Số điện thoại phải có 10 chữ số và bắt đầu bằng số 0');const row=await saveEntity('address',{...req.body,userId:req.user.id});if(bool(req.body.isDefault)){const old=await redis.sMembers(`user:${req.user.id}:addresses`);for(const id of old)await redis.hSet(`address:${id}`,{isDefault:'false'});}await redis.sAdd(`user:${req.user.id}:addresses`,row.id);res.status(201).json({...row,id:num(row.id),isDefault:bool(row.isDefault)});}));
app.get('/api/users/profile',auth,asyncRoute(async(req,res)=>res.json(publicUser(req.user))));
app.put('/api/users/profile',auth,asyncRoute(async(req,res)=>{if(req.body.phone&&!validPhone(req.body.phone))throw error('Số điện thoại phải có 10 chữ số và bắt đầu bằng số 0');const updates={fullName:req.body.fullName||req.user.fullName,phone:req.body.phone||'',updatedAt:now()};if(req.body.password){if(!verifyPassword(req.body.currentPassword,req.user.passwordHash))throw error('Mật khẩu hiện tại không đúng');if(String(req.body.password).length<8)throw error('Mật khẩu mới cần ít nhất 8 ký tự');updates.passwordHash=hashPassword(req.body.password);}await redis.hSet(`user:${req.user.id}`,updates);res.json(publicUser(await getHash(`user:${req.user.id}`)));}));
app.get('/api/users/loyalty-info',auth,asyncRoute(async(req,res)=>{const points=num(req.user.loyaltyPoints),tier=tierForPoints(points),names=['BRONZE','SILVER','GOLD','DIAMOND'],idx=names.indexOf(tier),next=names[idx+1]||null,nextMin=next?TIER_RULES[next].minPoints:points;res.json({fullName:req.user.fullName,loyaltyPoints:points,membershipTier:tier,totalSpent:num(req.user.totalSpent),tierDiscountPercent:TIER_RULES[tier].discount,nextTier:next,pointsToNextTier:next?Math.max(0,nextMin-points):0,progressPercentage:next?Math.min(100,Math.round(points/nextMin*100)):100,benefits:TIER_RULES[tier].benefits,allTiers:names.map(name=>({name,tierKey:name,isCurrent:name===tier,minPoints:TIER_RULES[name].minPoints,discountPercent:TIER_RULES[name].discount,label:TIER_RULES[name].label,benefits:TIER_RULES[name].benefits}))});}));

app.post('/api/orders',auth,asyncRoute(async(req,res)=>{
  if(!validPhone(req.body.shippingPhone))throw error('Số điện thoại phải có 10 chữ số và bắt đầu bằng số 0');
  const idem=String(req.headers['idempotency-key']||req.body.idempotencyKey||''); if(idem){const existing=await redis.get(`idempotency:${req.user.id}:${idem}`);if(existing)return res.status(202).json(await getOrder(existing));}
  const methods=await getJsonList('payment_method:ids','payment_method');const payment=methods.find(x=>x.methodCode===(req.body.paymentMethod||'COD')&&bool(x.isEnabled));if(!payment)throw error('Phương thức thanh toán không khả dụng');
  if(payment.methodCode==='BANK_TRANSFER'&&(!/^\d{6}$/.test(payment.bankBin||'')||!/^\d{4,30}$/.test(payment.accountNumber||'')))throw error('Ngân hàng nhận tiền chưa được cấu hình đúng');
  const cart=await cartDto(req.user.id);if(!cart.items.length)throw error('Giỏ hàng đang trống');
  const id=String(await redis.incr('order:id'));const jobId=`JOB_${Date.now()}_${crypto.randomBytes(3).toString('hex').toUpperCase()}`;let total=0;const items=[];
  for(const item of cart.items){const price=item.productSalePrice??item.productPrice;total+=price*item.quantity;items.push({id:item.productId,productId:item.productId,productName:item.productName,productImage:item.productImage,categoryId:item.categoryId,price,quantity:item.quantity});}
  let couponCode=String(req.body.couponCode||'').trim().toUpperCase();const couponResult=couponCode?await calculateCoupon(couponCode,total,items):await bestCoupon(total,items);couponCode=couponResult.coupon?.code||'';const currentUser=await getHash(`user:${req.user.id}`);const tier=tierForPoints(num(currentUser.loyaltyPoints));const tierPercent=TIER_RULES[tier].discount;const tierDiscount=Math.round(total*tierPercent/100);const discount=Math.min(total,couponResult.discount+tierDiscount);const finalAmount=Math.max(0,total-discount);const online=!['COD','TIEN_MAT',''].includes(String(req.body.paymentMethod||'COD').toUpperCase());
  const allowExceed=bool(req.body.allowExceedStock)||bool(req.query.allowExceedStock)||req.headers['x-allow-exceed-stock']==='true';
  const order={id,userId:req.user.id,customerName:req.user.fullName,shippingName:req.body.shippingName,shippingPhone:req.body.shippingPhone,shippingAddress:req.body.shippingAddress,paymentMethod:req.body.paymentMethod||'COD',paymentStatus:'PENDING',status:'CHO_TIEP_NHAN',totalAmount:total,couponDiscount:couponResult.discount,membershipDiscount:tierDiscount,membershipTier:tier,discountAmount:discount,finalAmount,couponCode,note:req.body.note||'',jobId,items,transferContent:online?(payment.transferSyntax||'MINIMART DH{MA_DON}').replace(/\{MA_DON\}|\{orderId\}/g,id).replace(/\{phone\}/g,req.body.shippingPhone):'',createdAt:now(),updatedAt:now()};
  await redis.hSet(`order:${id}`,Object.fromEntries(Object.entries(order).map(([k,v])=>[k,typeof v==='object'?JSON.stringify(v):String(v??'')])));if(couponResult.coupon)await redis.hIncrBy(`coupon:${couponResult.coupon.id}`,'usedCount',1);await redis.sAdd('order:ids',id);await redis.sAdd(`user:${req.user.id}:orders`,id);await redis.sAdd('orders:status:CHO_TIEP_NHAN',id);await redis.hSet(`mm:job:${jobId}`,{jobId,orderId:id,status:'PENDING',progress:'0%',message:'Đơn hàng đã vào Valkey Stream',createdAt:now(),retryCount:'0',maxRetries:'3'});await redis.sAdd('mm:job:ids',jobId);await redis.xAdd('mm:queue:orders','*',{jobId,orderId:id,userId:req.user.id});if(online)await redis.zAdd('mm:orders:payment_expiry',[{score:Date.now()+paymentTtl*1000,value:id}]);if(idem){await redis.set(`idempotency:${req.user.id}:${idem}`,id,{EX:86400});}await redis.del(`cart:${req.user.id}`);await addLog('INFO',`Tiếp nhận đơn #${id} vào Valkey Stream`,{jobId});if(online){await reserveAndProcess(jobId,id);const accepted=await getOrder(id);if(accepted.status==='TU_CHOI'&&!allowExceed)throw error('Không đủ tồn kho; đơn đã bị từ chối, chưa thanh toán');}res.status(202).json(orderDto(await getHash(`order:${id}`)));
}));
app.get('/api/orders/jobs/:jobId/status',auth,asyncRoute(async(req,res)=>{const j=await getHash(`mm:job:${req.params.jobId}`);if(!j)throw error('Không tìm thấy Job',404);res.json(j);}));
app.get('/api/orders/my-orders',auth,asyncRoute(async(req,res)=>res.json(await listOrders(await redis.sMembers(`user:${req.user.id}:orders`)))));
app.put('/api/orders/:id/cancel',auth,asyncRoute(async(req,res)=>{const o=await getOrder(req.params.id);if(!o||o.userId!==num(req.user.id))throw error('Không tìm thấy đơn hàng',404);if(!['CHO_TIEP_NHAN','CHO_XAC_NHAN','HUY'].includes(o.status))throw error('Đơn hàng đã được xử lý, không thể tự hủy');await cancelOrder(o,'Khách hàng hủy');res.json(await getOrder(o.id));}));

async function reserveAndProcess(jobId,orderId,customFailReason=null){
  const job=await getHash(`mm:job:${jobId}`);const order=await getOrder(orderId);if(!job||!order||order.status!=='CHO_TIEP_NHAN')return;
  await redis.hSet(`mm:job:${jobId}`,{status:'PROCESSING',progress:'30%',message:'Worker đang khóa và kiểm tra tồn kho',updatedAt:now()});
  const keys=order.items.map(i=>`product:${i.productId}`);const args=order.items.map(i=>String(i.quantity));
  const lua=`for i,k in ipairs(KEYS) do local s=tonumber(redis.call('HGET',k,'currentStock') or '0');local q=tonumber(ARGV[i]);if s<q then return {0,i,s,q} end end;for i,k in ipairs(KEYS) do redis.call('HINCRBY',k,'currentStock',-tonumber(ARGV[i])) end;return {1}`;
  const result=await redis.eval(lua,{keys,arguments:args});
  await redis.sRem('orders:status:CHO_TIEP_NHAN',String(orderId));
  if(num(result[0])!==1){
    const failMsg=customFailReason||`Thiếu tồn kho sản phẩm thứ ${result[1]}`;
    await redis.hSet(`order:${orderId}`,{status:'TU_CHOI',paymentStatus:'FAILED',note:customFailReason||`Worker từ chối do thiếu tồn kho`,updatedAt:now()});
    await redis.sAdd('orders:status:TU_CHOI',String(orderId));
    await redis.hSet(`mm:job:${jobId}`,{status:'FAILED',progress:'100%',message:failMsg,updatedAt:now()});
    await redis.zRem('mm:orders:payment_expiry',String(orderId));
    await addLog('ERROR',`Worker từ chối đơn #${orderId}: ${failMsg}`,{jobId});
    return;
  }
  const online=!['COD','TIEN_MAT'].includes(String(order.paymentMethod).toUpperCase());await redis.hSet(`order:${orderId}`,{status:'CHO_XAC_NHAN',updatedAt:now()});await redis.sAdd('orders:status:CHO_XAC_NHAN',String(orderId));await redis.hSet(`mm:job:${jobId}`,{status:online?'WAITING_PAYMENT':'SUCCEEDED',progress:online?'80%':'100%',message:online?'Đã giữ hàng, chờ Admin xác nhận thanh toán':'Đã xử lý kho thành công',updatedAt:now()});await addLog('SUCCESS',`Worker đã giữ tồn kho cho đơn #${orderId}`,{jobId});
}
async function awardPoints(order){
  const points=Math.floor(order.finalAmount/1000);
  await redis.eval(`if redis.call('HGET',KEYS[1],'pointsAwarded')=='true' then return 0 end;redis.call('HSET',KEYS[1],'pointsAwarded','true','paymentStatus','COMPLETED');redis.call('HINCRBY',KEYS[2],'loyaltyPoints',ARGV[1]);redis.call('HINCRBY',KEYS[2],'totalSpent',ARGV[2]);return 1`,{keys:[`order:${order.id}`,`user:${order.userId}`],arguments:[String(points),String(order.finalAmount)]});
}
async function restoreStock(order){for(const item of order.items)await redis.hIncrBy(`product:${item.productId}`,'currentStock',item.quantity);}
async function cancelOrder(order,reason){order=await getOrder(order.id);if(order.status==='HUY')return;if(['HOAN_THANH','DA_GIAO','DANG_GIAO'].includes(order.status))throw error('Không thể hủy đơn hàng ở trạng thái hiện tại');if(!['CHO_TIEP_NHAN','TU_CHOI'].includes(order.status))await restoreStock(order);await redis.sRem(`orders:status:${order.status}`,String(order.id));await redis.sAdd('orders:status:HUY',String(order.id));await redis.hSet(`order:${order.id}`,{status:'HUY',paymentStatus:'FAILED',note:reason,updatedAt:now()});await redis.zRem('mm:orders:payment_expiry',String(order.id));await redis.hSet(`mm:job:${order.jobId}`,{status:'CANCELLED',progress:'100%',message:reason,updatedAt:now()});await addLog('WARNING',`${reason}: đơn #${order.id}`,{jobId:order.jobId});}

app.get('/api/admin/orders',auth,requireRole('admin'),asyncRoute(async(req,res)=>res.json(await listOrders())));
app.put('/api/admin/orders/:id/status',auth,requireRole('admin'),asyncRoute(async(req,res)=>{const o=await getOrder(req.params.id);if(!o)throw error('Không tìm thấy đơn',404);const next=req.body.status;const allowed={CHO_XAC_NHAN:['DA_XAC_NHAN','HUY'],DA_XAC_NHAN:['DA_NHAN_DON','HUY'],DA_NHAN_DON:['DANG_GIAO','HUY'],DANG_GIAO:['HOAN_THANH','DA_GIAO','GIAO_THAT_BAI']};if(next===o.status)return res.json(o);if(!(allowed[o.status]||[]).includes(next))throw error('Chuyển trạng thái đơn hàng không hợp lệ');if(next==='HUY')await cancelOrder(o,'Admin hủy');else{await redis.sRem(`orders:status:${o.status}`,String(o.id));await redis.sAdd(`orders:status:${next}`,String(o.id));const updates={status:next,updatedAt:now()};if(next==='DA_XAC_NHAN'){updates.paymentStatus=['COD','TIEN_MAT'].includes(String(o.paymentMethod).toUpperCase())?'APPROVED_COD':'COMPLETED';await redis.zRem('mm:orders:payment_expiry',String(o.id));await redis.hSet(`mm:job:${o.jobId}`,{status:'SUCCEEDED',progress:'100%',message:'Admin đã xác nhận thanh toán',updatedAt:now()});}await redis.hSet(`order:${o.id}`,updates);if(next==='GIAO_THAT_BAI')await restoreStock(o);if(['HOAN_THANH','DA_GIAO'].includes(next))await awardPoints(o);await addLog('INFO',`Admin chuyển đơn #${o.id} sang ${next}`);}res.json(await getOrder(o.id));}));
app.patch('/api/admin/orders/:id/confirm-payment',auth,requireRole('admin'),asyncRoute(async(req,res)=>{req.body.status='DA_XAC_NHAN';const o=await getOrder(req.params.id);if(!o)throw error('Không tìm thấy đơn',404);if(o.status!=='CHO_XAC_NHAN')throw error('Đơn không ở trạng thái chờ xác nhận');await redis.hSet(`order:${o.id}`,{status:'DA_XAC_NHAN',paymentStatus:'COMPLETED',updatedAt:now()});await redis.zRem('mm:orders:payment_expiry',String(o.id));await redis.hSet(`mm:job:${o.jobId}`,{status:'SUCCEEDED',progress:'100%',message:'Admin đã xác nhận thanh toán',updatedAt:now()});res.json(await getOrder(o.id));}));

app.get('/api/admin/queue/summary',auth,requireRole('admin'),asyncRoute(async(req,res)=>{const ids=await redis.sMembers('mm:job:ids');let pending=0,processing=0,success=0,failed=0,waitingPayment=0;for(const id of ids){const s=await redis.hGet(`mm:job:${id}`,'status');if(s==='PENDING')pending++;else if(s==='PROCESSING')processing++;else if(s==='WAITING_PAYMENT')waitingPayment++;else if(s==='SUCCEEDED')success++;else if(['FAILED','FAILED_DLQ','CANCELLED'].includes(s))failed++;}res.json({streamLength:await redis.xLen('mm:queue:orders'),deadLetterLength:await redis.xLen('mm:queue:orders:dead'),retryLength:await redis.zCard('mm:retry:orders'),paymentExpiryLength:await redis.zCard('mm:orders:payment_expiry'),isPaused:(await redis.get('mm:system:worker_pause'))==='true',status:'CONNECTED',dbPendingCount:pending,dbProcessingCount:processing,dbWaitingPaymentCount:waitingPayment,dbSucceededCount:success,dbFailedCount:failed,valkeyAdminUrl:process.env.VALKEY_ADMIN_URL||'http://localhost:18080'});}));
app.get('/api/admin/queue/jobs',auth,requireRole('admin'),asyncRoute(async(req,res)=>{let ids=await redis.sMembers('mm:job:ids');const rows=[];for(const id of ids){const j=await getHash(`mm:job:${id}`);if(j&&(!req.query.status||req.query.status==='ALL'||j.status===req.query.status))rows.push({...j,id:j.jobId,order:{id:num(j.orderId)},retryCount:num(j.retryCount),maxRetries:num(j.maxRetries),errorMessage:(j.status.startsWith('FAILED')||j.status==='CANCELLED')?j.message:null,createdAt:j.createdAt});}rows.reverse();const page=num(req.query.page),size=num(req.query.size)||15;res.json({content:rows.slice(page*size,page*size+size),totalPages:Math.ceil(rows.length/size),number:page,totalElements:rows.length});}));
app.post('/api/admin/queue/toggle-pause',auth,requireRole('admin'),asyncRoute(async(req,res)=>{const value=(await redis.get('mm:system:worker_pause'))!=='true';await redis.set('mm:system:worker_pause',String(value));res.json({isPaused:value,message:value?'Đã tạm dừng Worker':'Worker đã tiếp tục'});}));
app.post('/api/admin/queue/simulate-failure',auth,requireRole('admin'),asyncRoute(async(req,res)=>{const id=`JOB_TEST_${Date.now()}`;await redis.hSet(`mm:job:${id}`,{jobId:id,orderId:'0',status:'FAILED_DLQ',progress:'100%',message:'Lỗi giả lập DLQ',retryCount:'3',maxRetries:'3',createdAt:now()});await redis.sAdd('mm:job:ids',id);await redis.xAdd('mm:queue:orders:dead','*',{jobId:id,error:'Lỗi giả lập'});res.json({success:true,message:'Đã tạo Job lỗi trong DLQ',jobId:id});}));
app.post('/api/admin/queue/jobs/:id/retry',auth,requireRole('admin'),asyncRoute(async(req,res)=>{const j=await getHash(`mm:job:${req.params.id}`);if(!j)throw error('Không tìm thấy Job',404);await redis.hSet(`mm:job:${req.params.id}`,{status:'PENDING',progress:'0%',retryCount:String(num(j.retryCount)+1),message:'Admin yêu cầu thử lại',updatedAt:now()});if(j.orderId!=='0'){const o=await getOrder(j.orderId);if(o&&['TU_CHOI','HUY'].includes(o.status)){await redis.sRem(`orders:status:${o.status}`,String(o.id));await redis.sAdd('orders:status:CHO_TIEP_NHAN',String(o.id));await redis.hSet(`order:${o.id}`,{status:'CHO_TIEP_NHAN',paymentStatus:'PENDING',note:'Đang thử lại đơn hàng',updatedAt:now()});}const online=o&&!['COD','TIEN_MAT'].includes(String(o.paymentMethod).toUpperCase());if(online){await redis.zAdd('mm:orders:payment_expiry',[{score:Date.now()+paymentTtl*1000,value:String(o.id)}]);}await redis.xAdd('mm:queue:orders','*',{jobId:req.params.id,orderId:j.orderId,userId:String(o?.userId||req.user.id)});}await addLog('INFO',`Admin yêu cầu thử lại Job #${req.params.id}`,{jobId:req.params.id});res.json({success:true,message:'Đã đưa Job trở lại hàng đợi'});}));
app.get('/api/admin/queue/activity-logs',auth,requireRole('admin'),asyncRoute(async(req,res)=>res.json(await readLogs(num(req.query.limit)||50))));
app.get('/api/admin/queue/payment-expiry',auth,requireRole('admin'),asyncRoute(async(req,res)=>{const rows=await redis.zRangeWithScores('mm:orders:payment_expiry',0,-1);res.json(rows.map(x=>({orderId:num(x.value),expiresAt:x.score,remainingSeconds:Math.max(0,Math.ceil((x.score-Date.now())/1000))})));}));

// API quản trị tương thích với giao diện hiện có, toàn bộ đều đọc/ghi Valkey.
app.get('/api/admin/products',auth,requireRole('admin'),asyncRoute(async(req,res)=>res.json(await allProducts())));
app.post('/api/admin/products',auth,requireRole('admin'),asyncRoute(async(req,res)=>res.status(201).json(productDto(await saveEntity('product',{...req.body,isActive:req.body.isActive!==false})))));
app.put('/api/admin/products/:id',auth,requireRole('admin'),asyncRoute(async(req,res)=>res.json(productDto(await saveEntity('product',req.body,req.params.id)))));
app.patch('/api/admin/products/:id/toggle-status',auth,requireRole('admin'),asyncRoute(async(req,res)=>{const p=await getHash(`product:${req.params.id}`);await redis.hSet(`product:${req.params.id}`,{isActive:String(!bool(p.isActive)),updatedAt:now()});res.json(productDto(await getHash(`product:${req.params.id}`)));}));
app.delete('/api/admin/products/:id',auth,requireRole('admin'),asyncRoute(async(req,res)=>{await redis.del(`product:${req.params.id}`);await redis.sRem('product:ids',req.params.id);res.json({message:'Đã xóa'});}));
for(const type of ['category','brand','coupon','supplier']){
  app.get(`/api/admin/${type==='category'?'categories':type==='brand'?'brands':type==='coupon'?'coupons':'suppliers'}`,auth,requireRole('admin'),asyncRoute(async(req,res)=>res.json((await getJsonList(`${type}:ids`,type)).map(x=>({...x,id:num(x.id),isActive:bool(x.isActive),...(type==='coupon'?{discountValue:num(x.discountValue),minOrderAmount:num(x.minOrderAmount),maxDiscountAmount:num(x.maxDiscountAmount),maxUses:num(x.maxUses),usedCount:num(x.usedCount),applicableCategoryId:num(x.applicableCategoryId)||null}: {})})))));
  app.post(`/api/admin/${type==='category'?'categories':type==='brand'?'brands':type==='coupon'?'coupons':'suppliers'}`,auth,requireRole('admin'),asyncRoute(async(req,res)=>{if(type==='supplier'&&req.body.phone&&!validPhone(req.body.phone))throw error('Số điện thoại phải có 10 chữ số và bắt đầu bằng số 0');if(type==='coupon'){await validateCoupon(req.body,null);req.body.code=String(req.body.code||'').trim().toUpperCase();if(!req.body.code)throw error('Mã coupon không được để trống');if(req.body.discountType==='PERCENTAGE'&&num(req.body.discountValue)>100)throw error('Phần trăm giảm không được vượt quá 100');req.body.usedCount=0;}res.status(201).json(await saveEntity(type,req.body));}));
  app.put(`/api/admin/${type==='category'?'categories':type==='brand'?'brands':type==='coupon'?'coupons':'suppliers'}/:id`,auth,requireRole('admin'),asyncRoute(async(req,res)=>{if(type==='supplier'&&req.body.phone&&!validPhone(req.body.phone))throw error('Số điện thoại phải có 10 chữ số và bắt đầu bằng số 0');if(type==='coupon')await validateCoupon(req.body,req.params.id);res.json(await saveEntity(type,req.body,req.params.id));}));
  app.delete(`/api/admin/${type==='category'?'categories':type==='brand'?'brands':type==='coupon'?'coupons':'suppliers'}/:id`,auth,requireRole('admin'),asyncRoute(async(req,res)=>{await redis.del(`${type}:${req.params.id}`);await redis.sRem(`${type}:ids`,req.params.id);res.json({message:'Đã xóa'});}));
}
app.get('/api/admin/users',auth,requireRole('admin'),asyncRoute(async(req,res)=>res.json((await getJsonList('user:ids','user')).map(publicUser))));
app.put('/api/admin/users/:id/toggle-status',auth,requireRole('admin'),asyncRoute(async(req,res)=>{const u=await getHash(`user:${req.params.id}`);await redis.hSet(`user:${req.params.id}`,{isActive:String(!bool(u.isActive)),updatedAt:now()});res.json(publicUser(await getHash(`user:${req.params.id}`)));}));
app.get('/api/admin/users/:id/details',auth,requireRole('admin'),asyncRoute(async(req,res)=>{const u=await getHash(`user:${req.params.id}`);if(!u)throw error('Không tìm thấy người dùng',404);res.json({...publicUser(u),orders:await listOrders(await redis.sMembers(`user:${u.id}:orders`))});}));
app.get('/api/admin/categories',auth,requireRole('admin'),asyncRoute(async(req,res)=>res.json((await getJsonList('category:ids','category')).map(x=>({...x,id:num(x.id),isActive:bool(x.isActive)})))));
app.get('/api/admin/brands',auth,requireRole('admin'),asyncRoute(async(req,res)=>res.json((await getJsonList('brand:ids','brand')).map(x=>({...x,id:num(x.id),isActive:bool(x.isActive)})))));
const listBatches=async()=>{const rows=(await getJsonList('batch:ids','batch')).map(x=>({...x,id:num(x.id),productId:num(x.productId),quantity:num(x.quantity),remainingQuantity:num(x.remainingQuantity??x.quantity),importPrice:num(x.importPrice)}));for(const row of rows){const product=await getHash(`product:${row.productId}`);row.productName=product?.name||row.productName||`Sản phẩm #${row.productId}`;}return rows.sort((a,b)=>b.id-a.id);};
app.get('/api/admin/batches',auth,requireRole('admin'),asyncRoute(async(req,res)=>res.json(await listBatches())));
app.get('/api/admin/batches/expired',auth,requireRole('admin'),asyncRoute(async(req,res)=>{const now=Date.now();res.json((await listBatches()).filter(x=>x.expiryDate&&new Date(x.expiryDate).getTime()<now&&x.status!=='DISPOSED'));}));
app.get('/api/admin/batches/expiring',auth,requireRole('admin'),asyncRoute(async(req,res)=>{const now=Date.now(),limit=now+30*86400000;res.json((await listBatches()).filter(x=>{const time=new Date(x.expiryDate).getTime();return x.expiryDate&&time>=now&&time<=limit&&x.status!=='DISPOSED';}));}));
app.post('/api/admin/batches/:id/dispose',auth,requireRole('admin'),asyncRoute(async(req,res)=>{const batch=await getHash(`batch:${req.params.id}`);if(!batch)throw error('Không tìm thấy lô hàng',404);if(batch.status==='DISPOSED')throw error('Lô hàng đã được tiêu hủy');const qty=num(batch.remainingQuantity??batch.quantity);const product=await getHash(`product:${batch.productId}`);if(product)await redis.hSet(`product:${batch.productId}`,{currentStock:String(Math.max(0,num(product.currentStock)-qty)),updatedAt:new Date().toISOString()});await redis.hSet(`batch:${req.params.id}`,{status:'DISPOSED',remainingQuantity:'0',disposedAt:new Date().toISOString(),disposeReason:String(req.body.reason||'Hết hạn')});res.json({message:'Đã ghi nhận tiêu hủy lô hàng'});}));
app.post('/api/admin/batches/batch/:id/clearance-sale',auth,requireRole('admin'),asyncRoute(async(req,res)=>{const batch=await getHash(`batch:${req.params.id}`);if(!batch)throw error('Không tìm thấy lô hàng',404);const discount=Math.min(90,Math.max(1,num(req.body.discountPercentage||req.body.discountPercent)));await redis.hSet(`batch:${req.params.id}`,{status:'CLEARANCE',clearanceDiscount:String(discount),clearanceAt:new Date().toISOString()});res.json({message:`Đã áp dụng giảm ${discount}% cho lô hàng`});}));
app.get('/api/admin/goods-receipts',auth,requireRole('admin'),asyncRoute(async(req,res)=>{const rows=await getJsonList('goods_receipt:ids','goods_receipt');res.json(rows.map(x=>({...x,id:num(x.id),supplierId:num(x.supplierId),totalAmount:num(x.totalAmount),items:json(x.items)})).sort((a,b)=>b.id-a.id));}));
app.post('/api/admin/goods-receipts',auth,requireRole('admin'),asyncRoute(async(req,res)=>{const supplier=await getHash(`supplier:${req.body.supplierId}`);if(!supplier)throw error('Nhà cung cấp không tồn tại');if(!Array.isArray(req.body.items)||!req.body.items.length)throw error('Phiếu nhập phải có ít nhất một mặt hàng');const items=[];let totalAmount=0;for(const raw of req.body.items){const product=await getHash(`product:${raw.productId}`);if(!product)throw error(`Sản phẩm #${raw.productId} không tồn tại`);if(!Number.isInteger(num(raw.quantity))||num(raw.quantity)<=0||!Number.isFinite(num(raw.importPrice))||num(raw.importPrice)<0)throw error('Số lượng hoặc giá nhập không hợp lệ');const itemId=String(await redis.incr('goods_receipt_item:id'));const item={id:num(itemId),productId:num(raw.productId),productName:product.name,quantity:num(raw.quantity),importPrice:num(raw.importPrice),batchName:raw.batchName||`LO-${Date.now()}`,expiryDate:raw.expiryDate||'',passedQuantity:null,rejectedQuantity:0};items.push(item);totalAmount+=item.quantity*item.importPrice;}const row=await saveEntity('goods_receipt',{supplierId:req.body.supplierId,supplierName:supplier.name,note:req.body.note||'',items,totalAmount,status:'DRAFT',createdBy:req.user.fullName});res.status(201).json({...row,id:num(row.id),items:json(row.items)});}));
app.put('/api/admin/goods-receipts/:id/complete',auth,requireRole('admin'),asyncRoute(async(req,res)=>{const receipt=await getHash(`goods_receipt:${req.params.id}`);if(!receipt)throw error('Không tìm thấy phiếu nhập',404);if(receipt.status!=='DRAFT')throw error('Chỉ có thể hoàn thành phiếu nháp');const items=json(receipt.items);for(const item of items){const before=num(await redis.hGet(`product:${item.productId}`,'currentStock'));const qty=item.passedQuantity==null?num(item.quantity):num(item.passedQuantity);await redis.hIncrBy(`product:${item.productId}`,'currentStock',qty);await saveEntity('inventory_ledger',{productId:item.productId,productName:item.productName,changeType:'IMPORT',quantityChange:qty,previousStock:before,newStock:before+qty,note:`Nhập kho theo PNK-${receipt.id}`,createdBy:req.user.fullName});if(item.batchName)await saveEntity('batch',{productId:item.productId,productName:item.productName,batchName:item.batchName,quantity:qty,remainingQuantity:qty,importPrice:item.importPrice,expiryDate:item.expiryDate,status:'ACTIVE'});}await redis.hSet(`goods_receipt:${receipt.id}`,{status:'COMPLETED',completedAt:now(),updatedAt:now()});res.json({message:'Đã hoàn thành phiếu nhập và cập nhật tồn kho'});}));
app.put('/api/admin/goods-receipts/:id/cancel',auth,requireRole('admin'),asyncRoute(async(req,res)=>{const receipt=await getHash(`goods_receipt:${req.params.id}`);if(!receipt)throw error('Không tìm thấy phiếu nhập',404);if(receipt.status!=='DRAFT')throw error('Chỉ có thể hủy phiếu nháp');await redis.hSet(`goods_receipt:${receipt.id}`,{status:'CANCELLED',updatedAt:now()});res.json({message:'Đã hủy phiếu nhập'});}));
app.post('/api/admin/goods-receipts/:id/qc-inspection',auth,requireRole('admin'),asyncRoute(async(req,res)=>{const receipt=await getHash(`goods_receipt:${req.params.id}`);if(!receipt)throw error('Không tìm thấy phiếu nhập',404);if(receipt.status!=='DRAFT')throw error('Phiếu đã xử lý, không thể kiểm định lại');const checks=new Map((req.body.items||[]).map(x=>[String(x.itemId),x]));const items=json(receipt.items).map(item=>{const c=checks.get(String(item.id));if(!c)return item;const passed=num(c.passedQuantity),rejected=num(c.rejectedQuantity);if(!Number.isInteger(passed)||!Number.isInteger(rejected)||passed<0||rejected<0||passed+rejected!==num(item.quantity))throw error(`Tổng đạt và loại của ${item.productName} phải bằng số lượng nhập`);return {...item,passedQuantity:passed,rejectedQuantity:rejected,rejectReason:c.rejectReason||'',qcNote:c.qcNote||''};});await redis.hSet(`goods_receipt:${receipt.id}`,{items:JSON.stringify(items),qcStatus:'COMPLETED',qcGeneralNote:req.body.generalNote||'',qcAt:now(),updatedAt:now()});res.json({message:'Đã lưu kết quả kiểm định'});}));
app.get('/api/admin/inventory-ledger',auth,requireRole('admin'),asyncRoute(async(req,res)=>{const rows=(await getJsonList('inventory_ledger:ids','inventory_ledger')).map(x=>({...x,id:num(x.id),productId:num(x.productId),quantityChange:num(x.quantityChange),previousStock:num(x.previousStock),newStock:num(x.newStock)})).sort((a,b)=>b.id-a.id);const page=num(req.query.page),size=num(req.query.size)||20;res.json({content:rows.slice(page*size,page*size+size),totalPages:Math.max(1,Math.ceil(rows.length/size)),number:page,totalElements:rows.length});}));
app.get('/api/admin/reviews/pending',auth,requireRole('admin'),asyncRoute(async(req,res)=>{const rows=[];for(const raw of await getJsonList('review:ids','review')){if((raw.status||'PENDING')!=='PENDING')continue;const user=await getHash(`user:${raw.userId}`),product=await getHash(`product:${raw.productId}`);rows.push({...raw,id:num(raw.id),userId:num(raw.userId),productId:num(raw.productId),rating:num(raw.rating),fullName:user?.fullName||'',username:user?.username||'',productName:product?.name||`Sản phẩm #${raw.productId}`});}res.json(rows.sort((a,b)=>b.id-a.id));}));
app.put('/api/admin/reviews/:id/approve',auth,requireRole('admin'),asyncRoute(async(req,res)=>{await redis.hSet(`review:${req.params.id}`,{status:'APPROVED',updatedAt:now()});res.json({message:'Đã duyệt đánh giá'});}));
app.delete('/api/admin/reviews/:id',auth,requireRole('admin'),asyncRoute(async(req,res)=>{await redis.del(`review:${req.params.id}`);await redis.sRem('review:ids',req.params.id);res.json({message:'Đã xóa đánh giá'});}));
app.get('/api/admin/payments/transactions',auth,requireRole('admin'),asyncRoute(async(req,res)=>res.json((await listOrders()).map(o=>({id:o.id,orderId:o.id,amount:o.finalAmount,customerName:o.customerName,customerPhone:o.shippingPhone,paymentMethod:o.paymentMethod,paymentStatus:o.paymentStatus,createdAt:o.createdAt})))));
app.get('/api/admin/payment-methods',auth,requireRole('admin'),asyncRoute(async(req,res)=>res.json((await getJsonList('payment_method:ids','payment_method')).map(x=>({...x,id:num(x.id),isEnabled:bool(x.isEnabled)})))));
app.put('/api/admin/payment-methods/:id',auth,requireRole('admin'),asyncRoute(async(req,res)=>res.json(await saveEntity('payment_method',req.body,req.params.id))));
app.post('/api/admin/payments/transactions/:id/approve',auth,requireRole('admin'),asyncRoute(async(req,res)=>{const o=await getOrder(req.params.id);if(!o)throw error('Không tìm thấy đơn hàng',404);if(o.status==='DA_XAC_NHAN')return res.json({message:'Đơn đã xác nhận'});if(o.status!=='CHO_XAC_NHAN')throw error('Đơn chưa sẵn sàng hoặc đã hủy');await redis.sRem(`orders:status:${o.status}`,String(o.id));await redis.sAdd('orders:status:DA_XAC_NHAN',String(o.id));await redis.hSet(`order:${o.id}`,{status:'DA_XAC_NHAN',paymentStatus:['COD','TIEN_MAT'].includes(String(o.paymentMethod).toUpperCase())?'APPROVED_COD':'COMPLETED',updatedAt:now()});await redis.zRem('mm:orders:payment_expiry',String(o.id));await redis.hSet(`mm:job:${o.jobId}`,{status:'SUCCEEDED',progress:'100%',message:'Admin đã duyệt thanh toán',updatedAt:now()});res.json({message:'Đã duyệt giao dịch và xác nhận đơn hàng'});}));
app.post('/api/admin/payments/transactions/:id/reject',auth,requireRole('admin'),asyncRoute(async(req,res)=>{const o=await getOrder(req.params.id);if(!o)throw error('Không tìm thấy đơn hàng',404);if(o.status!=='HUY')await cancelOrder(o,req.body.reason||'Thanh toán bị từ chối');res.json({message:'Đã từ chối giao dịch, hủy đơn và hoàn tồn kho'});}));
app.get('/api/admin/reports/overview',auth,requireRole('admin'),asyncRoute(async(req,res)=>{let orders=await listOrders();const end=new Date(),start=new Date(0),range=req.query.range||'30days';if(range==='today')start.setTime(new Date(end.getFullYear(),end.getMonth(),end.getDate()).getTime());else if(range==='7days')start.setTime(end.getTime()-7*86400000);else if(range==='30days')start.setTime(end.getTime()-30*86400000);else if(range==='thisMonth')start.setTime(new Date(end.getFullYear(),end.getMonth(),1).getTime());else if(range==='thisYear')start.setTime(new Date(end.getFullYear(),0,1).getTime());else if(range==='custom'&&req.query.startDate)start.setTime(new Date(req.query.startDate).getTime());if(range!=='all')orders=orders.filter(o=>new Date(o.createdAt)>=start&&(!req.query.endDate||new Date(o.createdAt)<=new Date(`${req.query.endDate}T23:59:59`)));const completed=orders.filter(x=>['HOAN_THANH','DA_GIAO'].includes(x.status));const monthMap=new Map(),productMap=new Map();for(const o of completed){const month=new Date(o.createdAt).toLocaleDateString('vi-VN',{month:'2-digit',year:'numeric'});const m=monthMap.get(month)||{month,revenue:0,orderCount:0};m.revenue+=o.finalAmount;m.orderCount++;monthMap.set(month,m);for(const item of o.items){const p=productMap.get(item.productId)||{productName:item.productName,quantity:0,revenue:0};p.quantity+=item.quantity;p.revenue+=item.price*item.quantity;productMap.set(item.productId,p);}}const statuses=['CHO_TIEP_NHAN','CHO_XAC_NHAN','DA_XAC_NHAN','DA_NHAN_DON','DANG_GIAO','HOAN_THANH','HUY','TU_CHOI'],colors=['#f59e0b','#eab308','#3b82f6','#8b5cf6','#06b6d4','#10b981','#ef4444','#64748b'],payColors=['#2563eb','#16a34a','#f97316','#8b5cf6'];const paymentCodes=[...new Set(orders.map(o=>o.paymentMethod||'COD'))],sold=[...productMap.values()].reduce((s,x)=>s+x.quantity,0),users=await getJsonList('user:ids','user'),customerCount=users.filter(x=>(x.role||'user')==='user').length;res.json({totalRevenue:completed.reduce((s,x)=>s+x.finalAmount,0),totalOrders:orders.length,totalProducts:await redis.sCard('product:ids'),totalUsers:users.length,totalCustomers:customerCount,totalProductsSold:sold,monthlyRevenues:[...monthMap.values()],orderStatusDistribution:statuses.map((name,i)=>({name,value:orders.filter(x=>x.status===name).length,status:name,count:orders.filter(x=>x.status===name).length,color:colors[i]})),paymentMethodDistribution:paymentCodes.map((name,i)=>({name,value:orders.filter(x=>(x.paymentMethod||'COD')===name).length,color:payColors[i%payColors.length]})),topSellingProducts:[...productMap.values()].sort((a,b)=>b.quantity-a.quantity).slice(0,10),shipperPerformance:users.filter(u=>u.role==='shipper').map(u=>{const assigned=orders.filter(o=>o.shipperId===num(u.id)),done=assigned.filter(o=>['HOAN_THANH','DA_GIAO'].includes(o.status)),failed=assigned.filter(o=>o.status==='GIAO_THAT_BAI');return {shipperName:u.fullName,phone:u.phone||'',district:u.district||'TP.HCM',assignedCount:assigned.length,deliveredCount:done.length,failedCount:failed.length,successRate:done.length+failed.length?Math.round(100*done.length/(done.length+failed.length)):0,codCollected:done.filter(o=>['COD','TIEN_MAT'].includes(o.paymentMethod)).reduce((n,o)=>n+o.finalAmount,0)};}),orderStatusData:statuses.map(status=>({status,count:orders.filter(x=>x.status===status).length})),revenueByDate:[...monthMap.values()]});}));
app.get('/api/admin/reports/expired-batches',auth,requireRole('admin'),asyncRoute(async(req,res)=>{const batches=(await listBatches()),today=Date.now(),expired=batches.filter(x=>x.expiryDate&&new Date(x.expiryDate).getTime()<today&&x.status!=='DISPOSED'),loss=expired.reduce((s,x)=>s+x.remainingQuantity*x.importPrice,0);res.json({batches:expired,totalExpiredBatches:expired.length,totalExpiredQuantity:expired.reduce((s,x)=>s+x.remainingQuantity,0),totalLossAmount:loss,totalLoss:loss});}));

app.get('/api/public/products/:id/reviews',asyncRoute(async(req,res)=>{const rows=[];for(const raw of await getJsonList('review:ids','review'))if(String(raw.productId)===String(req.params.id)&&raw.status==='APPROVED'){const user=await getHash(`user:${raw.userId}`);rows.push({...raw,id:num(raw.id),rating:num(raw.rating),fullName:user?.fullName||'Khách hàng'});}res.json(rows.sort((a,b)=>b.id-a.id));}));
app.post('/api/reviews',auth,asyncRoute(async(req,res)=>{const rating=num(req.body.rating);if(rating<1||rating>5)throw error('Đánh giá phải từ 1 đến 5 sao');const product=await getHash(`product:${req.body.productId}`);if(!product)throw error('Sản phẩm không tồn tại',404);res.status(201).json(await saveEntity('review',{...req.body,rating,userId:req.user.id,status:'PENDING'}));}));
app.get('/api/messages/my-messages',auth,asyncRoute(async(req,res)=>{const ids=await redis.sMembers(`user:${req.user.id}:messages`),rows=[];for(const id of ids){const x=await getHash(`message:${id}`);if(x)rows.push({...x,id:num(x.id),isRead:bool(x.isRead)});}res.json(rows.sort((a,b)=>a.id-b.id));}));
app.post('/api/messages/send',auth,asyncRoute(async(req,res)=>{if(!String(req.body.message||'').trim())throw error('Nội dung phản hồi không được để trống');const row=await saveEntity('message',{userId:req.user.id,userName:req.user.username,fullName:req.user.fullName,userEmail:req.user.email,userPhone:req.user.phone||'',message:String(req.body.message).trim(),senderType:'CUSTOMER',senderName:req.user.fullName,isRead:false});await redis.sAdd(`user:${req.user.id}:messages`,row.id);await redis.sAdd('message:customer_ids',req.user.id);res.status(201).json({...row,id:num(row.id),isRead:false});}));
app.get('/api/admin/messages/conversations',auth,requireRole('admin'),asyncRoute(async(req,res)=>{const users=await redis.sMembers('message:customer_ids'),rows=[];for(const userId of users){const u=await getHash(`user:${userId}`),ids=await redis.sMembers(`user:${userId}:messages`),messages=[];for(const id of ids){const m=await getHash(`message:${id}`);if(m)messages.push(m);}messages.sort((a,b)=>num(b.id)-num(a.id));if(u&&messages.length)rows.push({userId:num(userId),userName:u.username,fullName:u.fullName,userEmail:u.email,userPhone:u.phone||'',membershipTier:u.membershipTier||'BRONZE',lastMessage:messages[0].message,lastMessageAt:messages[0].createdAt,lastMessageTime:messages[0].createdAt,lastSenderType:messages[0].senderType,unreadCount:messages.filter(m=>m.senderType==='CUSTOMER'&&!bool(m.isRead)).length});}res.json(rows.sort((a,b)=>new Date(b.lastMessageAt)-new Date(a.lastMessageAt)));}));
app.get('/api/admin/messages/unread-count',auth,requireRole('admin'),asyncRoute(async(req,res)=>{const ids=await redis.sMembers('message:ids');let count=0;for(const id of ids){const m=await getHash(`message:${id}`);if(m&&m.senderType==='CUSTOMER'&&!bool(m.isRead))count++;}res.json({count});}));
app.get('/api/admin/messages/conversations/:id',auth,requireRole('admin'),asyncRoute(async(req,res)=>{const ids=await redis.sMembers(`user:${req.params.id}:messages`),rows=[];for(const id of ids){const x=await getHash(`message:${id}`);if(x){rows.push({...x,id:num(x.id),isRead:bool(x.isRead)});if(x.senderType==='CUSTOMER'&&!bool(x.isRead))await redis.hSet(`message:${id}`,{isRead:'true'});}}res.json(rows.sort((a,b)=>a.id-b.id));}));
app.post('/api/admin/messages/conversations/:id/reply',auth,requireRole('admin'),asyncRoute(async(req,res)=>{if(!String(req.body.message||'').trim())throw error('Nội dung trả lời không được để trống');const row=await saveEntity('message',{userId:req.params.id,message:String(req.body.message).trim(),senderType:'ADMIN',senderName:req.user.fullName,isRead:true});await redis.sAdd(`user:${req.params.id}:messages`,row.id);res.status(201).json({...row,id:num(row.id),isRead:true});}));
app.get('/api/admin/suppliers/:id/products',auth,requireRole('admin'),asyncRoute(async(req,res)=>res.json([])));
app.put('/api/admin/suppliers/:id/toggle-status',auth,requireRole('admin'),asyncRoute(async(req,res)=>{const x=await getHash(`supplier:${req.params.id}`);await redis.hSet(`supplier:${req.params.id}`,{isActive:String(!bool(x?.isActive)),updatedAt:now()});res.json({message:'Đã cập nhật'});}));
app.get('/api/admin/deliveries/shippers',auth,requireRole('admin'),asyncRoute(async(req,res)=>{const ids=await redis.sMembers('users:role:shipper');const rows=[];for(const id of ids){const u=await getHash(`user:${id}`);if(u)rows.push(publicUser(u));}res.json(rows);}));
app.get('/api/admin/deliveries/unassigned',auth,requireRole('admin'),asyncRoute(async(req,res)=>res.json((await listOrders()).filter(x=>x.status==='DA_XAC_NHAN'&&!x.shipperId))));
app.get('/api/admin/deliveries/tracking',auth,requireRole('admin'),asyncRoute(async(req,res)=>res.json((await listOrders()).filter(x=>x.shipperId))));
app.post('/api/admin/deliveries/assign',auth,requireRole('admin'),asyncRoute(async(req,res)=>{const ids=req.body.orderIds||[req.body.orderId];const shipper=await getHash(`user:${req.body.shipperId}`);for(const id of ids)await redis.hSet(`order:${id}`,{shipperId:String(req.body.shipperId),shipperName:shipper?.fullName||'Shipper',status:'DA_NHAN_DON',updatedAt:now()});res.json({message:'Đã phân công giao hàng'});}));
app.post('/api/admin/deliveries/auto-dispatch',auth,requireRole('admin'),asyncRoute(async(req,res)=>res.json({message:'Đã chạy điều phối tự động trên Valkey',assignedCount:0})));
app.post('/api/admin/deliveries/reassign',auth,requireRole('admin'),asyncRoute(async(req,res)=>{const shipper=await getHash(`user:${req.body.shipperId||req.body.newShipperId}`);await redis.hSet(`order:${req.body.orderId}`,{shipperId:String(req.body.shipperId||req.body.newShipperId),shipperName:shipper?.fullName||'Shipper',updatedAt:now()});res.json({message:'Đã phân công lại'});}));
app.get('/api/shipper/orders/my-deliveries',auth,requireRole('shipper'),asyncRoute(async(req,res)=>res.json((await listOrders()).filter(x=>x.shipperId===num(req.user.id)))));
app.get('/api/shipper/orders/:id',auth,requireRole('shipper'),asyncRoute(async(req,res)=>{const o=await getOrder(req.params.id);if(!o||o.shipperId!==num(req.user.id))throw error('Không tìm thấy đơn',404);res.json(o);}));
app.patch('/api/shipper/orders/:id/status',auth,requireRole('shipper'),asyncRoute(async(req,res)=>{const order=await getOrder(req.params.id);if(!order||order.shipperId!==num(req.user.id))throw error('Không tìm thấy đơn của bạn',404);const allowed={DA_NHAN_DON:['DANG_GIAO'],DANG_GIAO:['HOAN_THANH','DA_GIAO','GIAO_THAT_BAI']};if(!(allowed[order.status]||[]).includes(req.body.status))throw error('Chuyển trạng thái không hợp lệ');await redis.hSet(`order:${order.id}`,{status:req.body.status,deliveryNote:req.body.deliveryNote||'',updatedAt:now()});if(req.body.status==='GIAO_THAT_BAI')await restoreStock(order);if(['HOAN_THANH','DA_GIAO'].includes(req.body.status))await awardPoints(order);res.json(await getOrder(order.id));}));
app.post(['/api/admin/products/upload','/api/admin/payment-methods/upload-qr'],auth,requireRole('admin'),upload.single('file'),asyncRoute(async(req,res)=>{if(!req.file)throw error('Chọn ảnh JPG, PNG hoặc WebP, tối đa 5MB');res.json({url:`/uploads/${req.file.filename}`});}));
app.post('/api/admin/products/upload-multiple',auth,requireRole('admin'),upload.array('files',10),asyncRoute(async(req,res)=>{if(!req.files?.length)throw error('Không có ảnh hợp lệ');res.json({urls:req.files.map(f=>`/uploads/${f.filename}`)});}));

async function seed(){
  if(!await redis.get('app:seeded:v3')){
    await createUser({username:'admin',email:'admin@minimart.local',password:'pass1234',fullName:'Quản trị viên',role:'admin'});
    await createUser({username:'user1',email:'user1@minimart.local',password:'pass1234',fullName:'Nguyễn Văn An',role:'user',loyaltyPoints:1250,membershipTier:'DIAMOND'});
    await createUser({username:'shipper1',email:'shipper1@minimart.local',password:'pass1234',fullName:'Nguyễn Văn Giao',role:'shipper'});
    const cats=[['Rau củ quả','/uploads/cat_rau_cu_qua.jpg'],['Đồ uống','/uploads/cat_do_uong_giai_khat.jpg'],['Thực phẩm khô','/uploads/cat_mi_thuc_pham_kho.jpg'],['Sữa','/uploads/cat_sua_che_pham_sua.jpg']];for(const [name,image] of cats)await saveEntity('category',{name,image,isActive:true});
    for(const name of ['Vinamilk','Acecook','Coca-Cola','Vissan'])await saveEntity('brand',{name,isActive:true});
    const products=[['Cà chua Đà Lạt',32000,29000,1,1,'/uploads/ca_chua_dalat.jpg',40],['Xà lách thủy canh',28000,null,1,1,'/uploads/xa_lach_thuy_canh.jpg',35],['Coca Cola',12000,10000,2,3,'/uploads/coca_cola.jpg',80],['Mì Hảo Hảo',4500,null,3,2,'/uploads/mi_hao_hao.jpg',120],['Sữa Vinamilk 1L',38000,35000,4,1,'/uploads/sua_vinamilk_1l.jpg',50],['Gạo ST25',185000,null,3,2,'/uploads/gao_st25.jpg',25],['Thịt ba chỉ',145000,135000,1,4,'/uploads/thit_ba_chi.jpg',30],['Nước khoáng Lavie',7000,null,2,3,'/uploads/nuoc_khoang_lavie.jpg',100]];
    for(const [name,price,salePrice,categoryId,brandId,mainImage,currentStock] of products){const category=await getHash(`category:${categoryId}`),brand=await getHash(`brand:${brandId}`);await saveEntity('product',{name,description:`${name} chất lượng cao`,price,salePrice:salePrice||'',categoryId,categoryName:category.name,brandId,brandName:brand.name,mainImage,images:[],currentStock,minimumStock:5,unit:'Sản phẩm',sku:`SP${Date.now()}`,isActive:true});}
    await saveEntity('coupon',{code:'WELCOME10',name:'Chào mừng khách mới',discountType:'PERCENT',discountValue:10,isActive:true});
    await saveEntity('payment_method',{methodCode:'COD',methodName:'Thanh toán khi nhận hàng (COD)',description:'Thanh toán tiền mặt cho shipper',isEnabled:true,icon:'Banknote'});
    await saveEntity('payment_method',{methodCode:'BANK_TRANSFER',methodName:'Chuyển khoản ngân hàng (VietQR)',description:'Quét mã QR để thanh toán',bankName:'MB Bank',accountNumber:'0336174371',accountHolder:'MINIMART',transferSyntax:'MINIMART {MA_DON}',qrCodeUrl:'/uploads/maqr.jpg',isEnabled:true,icon:'QrCode'});
    await redis.set('app:seeded:v3','true');await addLog('INFO','Khởi tạo dữ liệu mẫu MiniMart trên Valkey');
  }
  if(!await redis.get('app:migrated:v5')){
    const future=new Date(Date.now()+365*86400000).toISOString(),past=new Date(Date.now()-86400000).toISOString();
    const coupons=[
      {code:'WELCOME10',description:'Giảm 10% toàn bộ đơn hàng',discountType:'PERCENTAGE',discountValue:10,minOrderAmount:100000,maxDiscountAmount:50000,maxUses:500,usedCount:0,startDate:past,endDate:future,isActive:true},
      {code:'RAUXANH15',description:'Giảm 15% cho danh mục Rau củ quả',discountType:'PERCENTAGE',discountValue:15,minOrderAmount:50000,maxDiscountAmount:40000,maxUses:300,usedCount:0,startDate:past,endDate:future,applicableCategoryId:1,isActive:true},
      {code:'DOUONG20',description:'Giảm 20% cho danh mục Đồ uống',discountType:'PERCENTAGE',discountValue:20,minOrderAmount:50000,maxDiscountAmount:30000,maxUses:300,usedCount:0,startDate:past,endDate:future,applicableCategoryId:2,isActive:true},
      {code:'GIAM30K',description:'Giảm trực tiếp 30.000đ',discountType:'FIXED_AMOUNT',discountValue:30000,minOrderAmount:250000,maxUses:200,usedCount:0,startDate:past,endDate:future,isActive:true},
      {code:'SUA12',description:'Giảm 12% cho danh mục Sữa',discountType:'PERCENTAGE',discountValue:12,minOrderAmount:80000,maxDiscountAmount:35000,maxUses:250,usedCount:0,startDate:past,endDate:future,applicableCategoryId:4,isActive:true}
    ];
    for(const value of coupons){let existing=null;for(const id of await redis.sMembers('coupon:ids')){const c=await getHash(`coupon:${id}`);if(c?.code===value.code){existing=c;break;}}if(existing)await saveEntity('coupon',{...existing,...value},existing.id);else await saveEntity('coupon',value);}
    if(await redis.sCard('supplier:ids')===0){await saveEntity('supplier',{name:'Nhà cung cấp MiniMart',contactName:'Nguyễn Tiến Tài',phone:'0336174371',email:'supplier@minimart.local',address:'TP. Hồ Chí Minh',isActive:true});}
    const paymentIds=await redis.sMembers('payment_method:ids');for(const id of paymentIds){const p=await getHash(`payment_method:${id}`);if(p?.methodCode==='BANK_TRANSFER')await redis.hSet(`payment_method:${id}`,{bankName:'MB Bank (Ngân hàng Quân Đội)',bankBin:'970422',accountNumber:'0336174371',accountHolder:'NGUYEN TIEN TAI',transferSyntax:'MINIMART DH{MA_DON}',isEnabled:'true',updatedAt:now()});}
    const imageByName={'Cà chua Đà Lạt':'/uploads/ca_chua_dalat.jpg','Xà lách thủy canh':'/uploads/xa_lach_thuy_canh.jpg','Coca Cola':'/uploads/coca_cola.jpg','Mì Hảo Hảo':'/uploads/mi_hao_hao.jpg','Sữa Vinamilk 1L':'/uploads/sua_vinamilk_1l.jpg','Gạo ST25':'/uploads/gao_st25.jpg','Thịt ba chỉ':'/uploads/thit_ba_chi.jpg','Nước khoáng Lavie':'/uploads/nuoc_khoang_lavie.jpg'};for(const id of await redis.sMembers('product:ids')){const p=await getHash(`product:${id}`);if(imageByName[p?.name])await redis.hSet(`product:${id}`,{mainImage:imageByName[p.name],updatedAt:now()});}
    await redis.set('app:migrated:v5','true');await addLog('INFO','Nâng cấp voucher, VietQR, nhà cung cấp và ảnh sản phẩm');
  }
}

const TIER_WEIGHTS = { DIAMOND: 4, GOLD: 3, SILVER: 2, BRONZE: 1 };
setInterval(()=>serialized(async()=>{
  try{
    if((await redis.get('mm:system:worker_pause'))==='true')return;
    const rawRows=await redis.xRevRange('mm:queue:orders','+','-');
    const rows=rawRows.reverse();
    const pendingRows=[];
    for(const r of rows){
      if(!(await redis.sIsMember('mm:processed:stream',r.id))){
        pendingRows.push(r);
      }
    }
    if(!pendingRows.length)return;

    const enriched=[];
    for(const row of pendingRows){
      const [tsPart]=row.id.split('-');
      const ts=Number(tsPart)||Date.now();
      const userId=row.message.userId;
      const u=userId?await getHash(`user:${userId}`):null;
      const tier=u?tierForPoints(num(u.loyaltyPoints)):'BRONZE';
      const weight=TIER_WEIGHTS[tier]||1;
      enriched.push({row,ts,tier,weight,lottery:Math.random()});
    }

    // 3-Tier Concurrency Conflict Resolution:
    // Level 1: FIFO (time difference > 10ms)
    // Level 2: Membership Tier (time difference <= 10ms, DIAMOND > GOLD > SILVER > BRONZE)
    // Level 3: Fair Random Lottery (same tier and time difference <= 10ms)
    enriched.sort((a,b)=>{
      const diff=a.ts-b.ts;
      if(Math.abs(diff)>10)return diff;
      if(b.weight!==a.weight)return b.weight-a.weight;
      return b.lottery-a.lottery;
    });

    for(let i=0;i<enriched.length;i++){
      const item=enriched[i];
      await redis.sAdd('mm:processed:stream',item.row.id);
      let customFail=null;
      if(i>0){
        const winner=enriched[0];
        if(Math.abs(item.ts-winner.ts)<=10){
          if(winner.weight>item.weight){
            customFail=`Worker từ chối: nhường quyền ưu tiên cho hội viên ${winner.tier}`;
          }else if(winner.weight===item.weight){
            customFail='Rất tiếc, bạn không may mắn trong lượt bốc thăm giữ sản phẩm cuối cùng';
          }
        }
      }
      await reserveAndProcess(item.row.message.jobId,item.row.message.orderId,customFail);
    }
  }catch(e){console.error('Worker:',e.message);}
}).catch(console.error),500);

setInterval(()=>serialized(async()=>{
  try{
    const due=await redis.zRangeByScore('mm:orders:payment_expiry',0,Date.now());
    for(const id of due){
      const o=await getOrder(id);
      if(o&&['CHO_TIEP_NHAN','CHO_XAC_NHAN'].includes(o.status)&&o.paymentStatus!=='COMPLETED'){
        if(o.status==='CHO_XAC_NHAN')await restoreStock(o);
        await redis.sRem(`orders:status:${o.status}`,String(id));
        await redis.sAdd('orders:status:HUY',String(id));
        await redis.hSet(`order:${id}`,{status:'HUY',paymentStatus:'FAILED',note:'Quá thời hạn thanh toán 30 giây (Admin chưa duyệt đơn)',updatedAt:now()});
        await redis.hSet(`mm:job:${o.jobId}`,{status:'FAILED',progress:'100%',message:'Quá thời hạn thanh toán 30 giây (Admin chưa duyệt đơn)',updatedAt:now()});
        await addLog('ERROR',`Quá thời hạn thanh toán 30 giây (Admin chưa duyệt đơn): đơn #${id}`,{jobId:o.jobId});
      }
      await redis.zRem('mm:orders:payment_expiry',String(id));
    }
  }catch(e){console.error('Expiry:',e.message);}
}).catch(console.error),1000);

const staticDir=path.join(__dirname,'..','dist');app.use(express.static(staticDir));app.get('*',(req,res)=>{if(req.path.startsWith('/api/'))return res.status(404).json({error:'API không tồn tại'});res.sendFile(path.join(staticDir,'index.html'));});
app.use((err,req,res,next)=>{console.error(err);res.status(err.status||500).json({error:err.message||'Lỗi hệ thống'});});

redis.connect().then(seed).then(()=>app.listen(port,()=>console.log(`MiniMart Valkey NoSQL: http://localhost:${port}`))).catch(err=>{console.error(err);process.exit(1);});

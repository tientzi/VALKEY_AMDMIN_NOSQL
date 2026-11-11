"""Run against an isolated database. Never point this test at production."""
import os, subprocess, time, requests, sys
from pathlib import Path
root=Path(__file__).resolve().parents[2]
binary=os.environ.get('TEST_REDIS_BINARY','redis-server')
db=subprocess.Popen([binary,'--port','16379','--bind','127.0.0.1','--save','','--appendonly','no'],stdout=subprocess.DEVNULL)
log=open('/tmp/minimart-test.log','w')
app=subprocess.Popen(['node','backend/server.js'],cwd=root,env={**os.environ,'VALKEY_URL':'redis://127.0.0.1:16379','PORT':'13001'},stdout=log,stderr=log)
base='http://127.0.0.1:13001'; checks=[]
def call(method,path,data=None,token=None,expected=200):
 r=requests.request(method,base+path,json=data,headers={'Authorization':'Bearer '+token} if token else {},timeout=10)
 assert r.status_code==expected,(method,path,r.status_code,r.text)
 return r.json()
def ok(name): checks.append(name);print('PASS',name,flush=True)
try:
 for i in range(60):
  try:
   if requests.get(base+'/api/health',timeout=.5).ok:break
  except requests.RequestException:pass
  time.sleep(.2)
 else:raise RuntimeError(Path('/tmp/minimart-test.log').read_text())
 admin=call('POST','/api/auth/login',{'usernameOrEmail':'admin','password':'pass1234'})['accessToken']
 user=call('POST','/api/auth/login',{'usernameOrEmail':'user1','password':'pass1234'})['accessToken']
 ok('login and health')
 call('POST','/api/addresses',{'receiverPhone':'9123456789'},user,400)
 call('PUT','/api/users/profile',{'phone':'1234567890'},user,400)
 ok('phone starts with zero enforced by API')
 tiers=call('GET','/api/users/loyalty-info',token=user)
 assert tiers['membershipTier']=='GOLD' and all(t['tierKey'] for t in tiers['allTiers'])
 ok('membership DTO')
 products=call('GET','/api/public/products');p=next(x for x in products if x['categoryId']==1)
 cart=call('POST','/api/cart/add',{'productId':p['id'],'quantity':4},user)
 assert cart['items'][0]['maxStock']>0 and cart['items'][0]['productMainImage']
 assert requests.get(base+cart['items'][0]['productMainImage']).ok
 call('POST','/api/cart/add',{'productId':p['id'],'quantity':1.5},user,400)
 ok('cart images, stock, integer quantities')
 coupon=call('POST','/api/public/coupons/apply',{'code':'RAUXANH15','amount':1},user)
 assert coupon['discountAmount']>0
 call('POST','/api/public/coupons/apply',{'code':'DOUONG20'},user,400)
 ok('category voucher and server-authoritative subtotal')
 order=call('POST','/api/orders',{'shippingName':'Test','shippingPhone':'0901234567','shippingAddress':'Test address','paymentMethod':'BANK_TRANSFER','couponCode':'RAUXANH15'},user,202)
 assert order['finalAmount']==order['totalAmount']-order['couponDiscount']-order['membershipDiscount']
 assert str(order['id']) in order['transferContent']
 for i in range(30):
  orders=call('GET','/api/orders/my-orders',token=user)
  if orders[0]['status']=='CHO_XAC_NHAN':break
  time.sleep(.2)
 call('PUT',f"/api/orders/{order['id']}/cancel",token=user)
 stock=call('GET',f"/api/public/products/{p['id']}")['currentStock']
 call('PUT',f"/api/orders/{order['id']}/cancel",token=user)
 assert call('GET',f"/api/public/products/{p['id']}")['currentStock']==stock==p['currentStock']
 call('POST',f"/api/admin/payments/transactions/{order['id']}/approve",token=admin,expected=400)
 ok('exact payment amount, reserve, cancel idempotence, no approval after cancel')
 call('POST','/api/messages/send',{'message':'Integration feedback'},user,201)
 conv=call('GET','/api/admin/messages/conversations',token=admin)
 assert conv[0]['lastMessage']=='Integration feedback' and conv[0]['lastMessageTime']
 call('POST',f"/api/admin/messages/conversations/{conv[0]['userId']}/reply",{'message':'Reply test'},admin,201)
 assert len(call('GET','/api/messages/my-messages',token=user))==2
 ok('customer/admin feedback roundtrip')
 assert call('POST','/api/public/chat',{'message':'voucher'})['response']
 ok('rule-based chatbot')
 sup=call('GET','/api/admin/suppliers',token=admin)[0]
 receipt=call('POST','/api/admin/goods-receipts',{'supplierId':sup['id'],'items':[{'productId':p['id'],'quantity':5,'importPrice':1000}]},admin,201)
 call('POST',f"/api/admin/goods-receipts/{receipt['id']}/qc-inspection",{'items':[{'itemId':receipt['items'][0]['id'],'passedQuantity':4,'rejectedQuantity':1}]},admin)
 call('PUT',f"/api/admin/goods-receipts/{receipt['id']}/complete",token=admin)
 call('PUT',f"/api/admin/goods-receipts/{receipt['id']}/complete",token=admin,expected=400)
 assert call('GET',f"/api/public/products/{p['id']}")['currentStock']==stock+4
 ok('receipt QC accepted quantity and duplicate completion guard')
 assert call('GET','/api/admin/reports/overview?range=all',token=admin)['totalCustomers']==1
 assert len(call('GET','/api/admin/coupons',token=admin))>=5
 ok('reports and admin coupons')
 call('POST','/api/auth/forgot-password',{'email':'admin@minimart.local','newPassword':'hacked123'},expected=400)
 ok('reject unauthenticated password takeover')
 quote=call('GET','/api/cart/quote',token=user)
 assert quote['finalAmount']==0
 call('POST','/api/cart/add',{'productId':p['id'],'quantity':4},user)
 quote=call('GET','/api/cart/quote',token=user)
 assert quote['couponCode'] and quote['couponDiscount']>=coupon['discountAmount'],quote
 order2=call('POST','/api/orders',{'shippingName':'Test','shippingPhone':'0901234567','shippingAddress':'Test','paymentMethod':'BANK_TRANSFER'},user,202)
 assert order2['finalAmount']==quote['finalAmount']
 call('POST',f"/api/admin/payments/transactions/{order2['id']}/approve",token=admin)
 call('PUT',f"/api/admin/orders/{order2['id']}/status",{'status':'DA_NHAN_DON'},admin)
 call('PUT',f"/api/admin/orders/{order2['id']}/status",{'status':'DANG_GIAO'},admin)
 call('PUT',f"/api/admin/orders/{order2['id']}/status",{'status':'HOAN_THANH'},admin)
 credited=call('GET','/api/users/loyalty-info',token=user)['loyaltyPoints']
 assert credited==1250+order2['finalAmount']//1000
 call('PUT',f"/api/admin/orders/{order2['id']}/status",{'status':'HOAN_THANH'},admin)
 assert call('GET','/api/users/loyalty-info',token=user)['loyaltyPoints']==credited
 ok('auto best voucher and exactly-once membership points')
 scarce=call('POST','/api/admin/products',{'name':'Last item test','price':10000,'currentStock':1,'isActive':True},admin,201)
 call('POST','/api/auth/register',{'username':'user2','email':'user2@test.local','password':'test1234'},expected=201)
 user2=call('POST','/api/auth/login',{'usernameOrEmail':'user2','password':'test1234'})['accessToken']
 for t in [user,user2]:call('POST','/api/cart/add',{'productId':scarce['id'],'quantity':1},t)
 import concurrent.futures
 def buy(t):return requests.post(base+'/api/orders',headers={'Authorization':'Bearer '+t},json={'shippingName':'Test','shippingPhone':'0901234567','shippingAddress':'Test','paymentMethod':'BANK_TRANSFER'},timeout=10)
 with concurrent.futures.ThreadPoolExecutor(2) as pool:results=list(pool.map(buy,[user,user2]))
 assert sorted(x.status_code for x in results)==[202,400],[(x.status_code,x.text) for x in results]
 assert call('GET',f"/api/public/products/{scarce['id']}")['currentStock']==0
 ok('concurrent purchase of final unit cannot oversell')
 image=root/'uploads/ca_chua_dalat.jpg'
 with image.open('rb') as f:
  result=requests.post(base+'/api/admin/products/upload',headers={'Authorization':'Bearer '+admin},files={'file':('test.jpg',f,'image/jpeg')},timeout=10)
 assert result.ok,result.text
 uploaded=result.json()['url'];assert requests.get(base+uploaded).content==image.read_bytes()
 (root/uploaded.lstrip('/')).unlink()
 ok('real image upload and retrieval')
 print(f'{len(checks)} groups passed')
finally:
 app.terminate();db.terminate();app.wait(timeout=5);db.wait(timeout=5);log.close()

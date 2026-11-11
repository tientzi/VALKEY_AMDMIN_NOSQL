/**
 * Automated Test Suite for MiniMart Valkey NoSQL Queue Worker
 * Covers all 8 Scenarios defined in BAO_CAO_KIEN_TRUC_WORKER_VALKEY_VA_KICH_BAN_KIEM_THU.md
 */

const BASE = process.env.BASE_URL || 'http://localhost:13000';

async function req(path, options = {}) {
  const url = `${BASE}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
      ...(options.headers || {})
    },
    body: options.body ? JSON.stringify(options.body) : undefined
  });
  let data = null;
  const text = await res.text();
  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }
  return { status: res.status, ok: res.ok, data };
}

function logPass(scenarioNum, title) {
  console.log(`\x1b[32m[PASS]\x1b[0m Kịch bản ${scenarioNum}: ${title}`);
}

function logFail(scenarioNum, title, err) {
  console.error(`\x1b[31m[FAIL]\x1b[0m Kịch bản ${scenarioNum}: ${title}`);
  console.error(err);
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function runAllTests() {
  console.log(`\n======================================================`);
  console.log(`BẮT ĐẦU KIỂM THỬ 8 KỊCH BẢN WORKER VALKEY NOSQL`);
  console.log(`Target URL: ${BASE}`);
  console.log(`======================================================\n`);

  // Health check
  const health = await req('/api/health');
  if (!health.ok) {
    throw new Error(`Server không phản hồi tại ${BASE}. Hãy kiểm tra container hoặc backend.`);
  }

  // Login accounts
  const adminRes = await req('/api/auth/login', {
    method: 'POST',
    body: { usernameOrEmail: 'admin', password: 'pass1234' }
  });
  const adminToken = adminRes.data.accessToken;

  const userRes = await req('/api/auth/login', {
    method: 'POST',
    body: { usernameOrEmail: 'user1', password: 'pass1234' }
  });
  const userToken = userRes.data.accessToken;

  // -------------------------------------------------------------------------
  // KỊCH BẢN 1: Quy trình Xử lý Thành công (Happy Path - COD)
  // -------------------------------------------------------------------------
  try {
    const productsRes = await req('/api/public/products');
    const p = productsRes.data.find(x => x.name.includes('Cà chua') || x.currentStock > 10);
    const initialStock = p.currentStock;

    // Add 2 items
    await req('/api/cart/add', {
      method: 'POST',
      token: userToken,
      body: { productId: p.id, quantity: 2 }
    });

    const orderRes = await req('/api/orders', {
      method: 'POST',
      token: userToken,
      body: {
        shippingName: 'Người nhận KB1',
        shippingPhone: '0912345678',
        shippingAddress: '123 Đường Mẫu, Q. Tân Phú, TP.HCM',
        paymentMethod: 'COD',
        note: 'Test Happy Path COD'
      }
    });

    const order = orderRes.data;
    // Wait for Worker loop (500ms)
    let job = null;
    for (let i = 0; i < 15; i++) {
      await sleep(300);
      const jRes = await req(`/api/orders/jobs/${order.jobId}/status`, { token: userToken });
      if (jRes.data?.status === 'SUCCEEDED') {
        job = jRes.data;
        break;
      }
    }

    const updatedPRes = await req(`/api/public/products/${p.id}`);
    const finalStock = updatedPRes.data.currentStock;

    if (job?.status === 'SUCCEEDED' && finalStock === initialStock - 2) {
      logPass(1, 'Happy Path COD - Worker trừ tồn kho và Job đạt SUCCEEDED 100%');
    } else {
      throw new Error(`Job status: ${job?.status}, Tồn kho: ${finalStock} (Kỳ vọng: ${initialStock - 2})`);
    }
  } catch (err) {
    logFail(1, 'Happy Path COD', err);
  }

  // -------------------------------------------------------------------------
  // KỊCH BẢN 2: Quy trình Lỗi Vượt Tồn Kho (Worker phát hiện và từ chối)
  // -------------------------------------------------------------------------
  try {
    const pRes = await req('/api/admin/products', {
      method: 'POST',
      token: adminToken,
      body: { name: 'Sản phẩm Test Vượt Kho', price: 50000, currentStock: 5, isActive: true }
    });
    const p = pRes.data;

    // Add 15 items (stock is only 5) with allowExceedStock
    await req('/api/cart/add', {
      method: 'POST',
      token: userToken,
      body: { productId: p.id, quantity: 15, allowExceedStock: true }
    });

    const orderRes = await req('/api/orders', {
      method: 'POST',
      token: userToken,
      body: {
        shippingName: 'Khách hàng KB2',
        shippingPhone: '0912345678',
        shippingAddress: '456 Đường Test, Q. Tân Phú, TP.HCM',
        paymentMethod: 'COD',
        allowExceedStock: true
      }
    });

    const order = orderRes.data;
    let job = null;
    for (let i = 0; i < 15; i++) {
      await sleep(300);
      const jRes = await req(`/api/orders/jobs/${order.jobId}/status`, { token: userToken });
      if (jRes.data?.status === 'FAILED') {
        job = jRes.data;
        break;
      }
    }

    const checkOrderRes = await req('/api/orders/my-orders', { token: userToken });
    const checkOrder = checkOrderRes.data.find(o => o.id === order.id);

    if (job?.status === 'FAILED' && checkOrder?.status === 'TU_CHOI') {
      logPass(2, `Lỗi Vượt Tồn Kho - Worker từ chối: "${job.message}", đơn TU_CHOI`);
    } else {
      throw new Error(`Job status: ${job?.status}, Order status: ${checkOrder?.status}`);
    }
  } catch (err) {
    logFail(2, 'Lỗi Vượt Tồn Kho', err);
  }

  // -------------------------------------------------------------------------
  // KỊCH BẢN 3: Quá Hạn Thanh Toán 30 Giây (Sorted Set Scheduler quét & tự hủy)
  // -------------------------------------------------------------------------
  try {
    console.log('   ⏳ Đang chạy Kịch bản 3 (Đợi TTL 30 giây hết hạn, vui lòng chờ ~32s)...');
    const pRes = await req('/api/admin/products', {
      method: 'POST',
      token: adminToken,
      body: { name: 'Sản phẩm Test Timeout 30s', price: 60000, currentStock: 10, isActive: true }
    });
    const p = pRes.data;
    const initialStock = p.currentStock;

    await req('/api/cart/add', {
      method: 'POST',
      token: userToken,
      body: { productId: p.id, quantity: 2 }
    });

    const orderRes = await req('/api/orders', {
      method: 'POST',
      token: userToken,
      body: {
        shippingName: 'Khách hàng KB3',
        shippingPhone: '0912345678',
        shippingAddress: '789 Đường Test, Q. Tân Bình, TP.HCM',
        paymentMethod: 'BANK_TRANSFER'
      }
    });

    const order = orderRes.data;
    // Check stock was reserved
    const reservedP = (await req(`/api/public/products/${p.id}`)).data;
    if (reservedP.currentStock !== initialStock - 2) {
      throw new Error(`Tồn kho chưa được giữ: ${reservedP.currentStock}`);
    }

    // Wait 32 seconds for Expiry scheduler to trigger
    await sleep(32000);

    const checkJob = (await req(`/api/orders/jobs/${order.jobId}/status`, { token: userToken })).data;
    const checkOrder = (await req('/api/orders/my-orders', { token: userToken })).data.find(o => o.id === order.id);
    const restoredP = (await req(`/api/public/products/${p.id}`)).data;

    if (
      checkJob?.status === 'FAILED' &&
      checkOrder?.status === 'HUY' &&
      restoredP.currentStock === initialStock
    ) {
      logPass(3, `Quá Hạn Thanh Toán 30s - Tự hủy đơn (${checkOrder.status}), Job FAILED, hoàn kho 100% (${restoredP.currentStock})`);
    } else {
      throw new Error(`Job: ${checkJob?.status}, Order: ${checkOrder?.status}, Stock: ${restoredP.currentStock}`);
    }
  } catch (err) {
    logFail(3, 'Quá Hạn Thanh Toán 30s', err);
  }

  // -------------------------------------------------------------------------
  // KỊCH BẢN 4: Thử lại (Retry Mechanism sau khi nhập kho)
  // -------------------------------------------------------------------------
  try {
    const scarceRes = await req('/api/admin/products', {
      method: 'POST',
      token: adminToken,
      body: { name: 'Sản phẩm Test Retry', price: 40000, currentStock: 0, isActive: true }
    });
    const scarce = scarceRes.data;

    await req('/api/cart/add', {
      method: 'POST',
      token: userToken,
      body: { productId: scarce.id, quantity: 5, allowExceedStock: true }
    });

    const orderRes = await req('/api/orders', {
      method: 'POST',
      token: userToken,
      body: {
        shippingName: 'Khách hàng KB4',
        shippingPhone: '0912345678',
        shippingAddress: '101 Đường Test, Q. 12, TP.HCM',
        paymentMethod: 'COD',
        allowExceedStock: true
      }
    });
    const order = orderRes.data;

    await sleep(1000);
    const failedJob = (await req(`/api/orders/jobs/${order.jobId}/status`, { token: userToken })).data;
    if (failedJob.status !== 'FAILED') {
      throw new Error(`Job chưa fail như mong đợi: ${failedJob.status}`);
    }

    // Admin updates stock to 50
    await req(`/api/admin/products/${scarce.id}`, {
      method: 'PUT',
      token: adminToken,
      body: { ...scarce, currentStock: 50 }
    });

    // Admin retries the failed job
    const retryRes = await req(`/api/admin/queue/jobs/${order.jobId}/retry`, {
      method: 'POST',
      token: adminToken
    });

    if (!retryRes.ok) {
      throw new Error(`Gọi API retry thất bại: ${JSON.stringify(retryRes.data)}`);
    }

    // Wait for Worker to reprocess
    let retriedJob = null;
    for (let i = 0; i < 15; i++) {
      await sleep(300);
      const jRes = await req(`/api/orders/jobs/${order.jobId}/status`, { token: userToken });
      if (jRes.data?.status === 'SUCCEEDED') {
        retriedJob = jRes.data;
        break;
      }
    }

    if (retriedJob?.status === 'SUCCEEDED' && Number(retriedJob.retryCount) >= 1) {
      logPass(4, `Thử lại Job - RetryCount = ${retriedJob.retryCount}, Job phục hồi SUCCEEDED thành công!`);
    } else {
      throw new Error(`Job retry thất bại: status = ${retriedJob?.status}, retryCount = ${retriedJob?.retryCount}`);
    }
  } catch (err) {
    logFail(4, 'Thử lại Job (Retry Mechanism)', err);
  }

  // -------------------------------------------------------------------------
  // KỊCH BẢN 5: Tạm Dừng & Phục Hồi Hàng Đợi (Queue Backpressure)
  // -------------------------------------------------------------------------
  try {
    // 1. Pause Worker
    const pauseRes = await req('/api/admin/queue/toggle-pause', { method: 'POST', token: adminToken });
    if (!pauseRes.data?.isPaused) {
      // Toggle once more if it was already paused
      await req('/api/admin/queue/toggle-pause', { method: 'POST', token: adminToken });
    }

    // 2. Client places order
    const p = (await req('/api/public/products')).data.find(x => x.currentStock > 10);
    await req('/api/cart/add', { method: 'POST', token: userToken, body: { productId: p.id, quantity: 1 } });
    const orderRes = await req('/api/orders', {
      method: 'POST',
      token: userToken,
      body: { shippingName: 'KB5 Pause Test', shippingPhone: '0912345678', shippingAddress: 'Test Q5', paymentMethod: 'COD' }
    });

    await sleep(1000);
    const pendingJob = (await req(`/api/orders/jobs/${orderRes.data.jobId}/status`, { token: userToken })).data;
    if (pendingJob.status !== 'PENDING') {
      throw new Error(`Job không ở trạng thái PENDING khi Worker bị dừng: ${pendingJob.status}`);
    }

    // 3. Unpause Worker
    await req('/api/admin/queue/toggle-pause', { method: 'POST', token: adminToken });

    // Wait for Worker to wake up
    let processedJob = null;
    for (let i = 0; i < 15; i++) {
      await sleep(300);
      const j = (await req(`/api/orders/jobs/${orderRes.data.jobId}/status`, { token: userToken })).data;
      if (j.status === 'SUCCEEDED') {
        processedJob = j;
        break;
      }
    }

    if (processedJob?.status === 'SUCCEEDED') {
      logPass(5, 'Tạm Dừng & Phục Hồi Hàng Đợi - Job được buffer trong Stream và tự động tiêu thụ khi tiếp tục');
    } else {
      throw new Error(`Job sau khi tiếp tục: ${processedJob?.status}`);
    }
  } catch (err) {
    logFail(5, 'Tạm Dừng & Phục Hồi Hàng Đợi', err);
  }

  // -------------------------------------------------------------------------
  // KỊCH BẢN 6: Dead Letter Queue (DLQ)
  // -------------------------------------------------------------------------
  try {
    const simRes = await req('/api/admin/queue/simulate-failure', { method: 'POST', token: adminToken });
    const summaryRes = await req('/api/admin/queue/summary', { token: adminToken });

    if (simRes.ok && summaryRes.data.deadLetterLength >= 1) {
      logPass(6, `Dead Letter Queue (DLQ) - Giả lập lỗi thành công, DLQ count = ${summaryRes.data.deadLetterLength}`);
    } else {
      throw new Error(`Không thấy tin nhắn trong DLQ: ${JSON.stringify(summaryRes.data)}`);
    }
  } catch (err) {
    logFail(6, 'Dead Letter Queue (DLQ)', err);
  }

  // -------------------------------------------------------------------------
  // KỊCH BẢN 7: Idempotency Key Guard
  // -------------------------------------------------------------------------
  try {
    const p = (await req('/api/public/products')).data.find(x => x.currentStock > 10);
    const initialStock = p.currentStock;
    await req('/api/cart/add', { method: 'POST', token: userToken, body: { productId: p.id, quantity: 1 } });

    const key = `idem_${Date.now()}_test`;
    const res1 = await req('/api/orders', {
      method: 'POST',
      token: userToken,
      headers: { 'idempotency-key': key },
      body: { shippingName: 'Test Idem', shippingPhone: '0912345678', shippingAddress: 'Test Idem', paymentMethod: 'COD' }
    });

    // Re-send same request with same key
    const res2 = await req('/api/orders', {
      method: 'POST',
      token: userToken,
      headers: { 'idempotency-key': key },
      body: { shippingName: 'Test Idem', shippingPhone: '0912345678', shippingAddress: 'Test Idem', paymentMethod: 'COD' }
    });

    if (res1.data.id === res2.data.id) {
      logPass(7, `Chống Trùng Lặp (Idempotency) - Gửi 2 lần cùng key, Backend trả về cùng 1 mã đơn #${res1.data.id}`);
    } else {
      throw new Error(`Tạo 2 đơn khác nhau: #${res1.data.id} vs #${res2.data.id}`);
    }
  } catch (err) {
    logFail(7, 'Chống Trùng Lặp (Idempotency)', err);
  }

  // -------------------------------------------------------------------------
  // KỊCH BẢN 8: Tranh Chấp Tồn Kho 3 Cấp Độ (FIFO, Membership Tier, Fair Lottery)
  // -------------------------------------------------------------------------
  try {
    // Register user2 (BRONZE)
    const u2Name = `u2_${Date.now().toString().slice(-4)}`;
    await req('/api/auth/register', {
      method: 'POST',
      body: { username: u2Name, email: `${u2Name}@test.local`, password: 'pass1234', fullName: 'Khách Hàng Bronze' }
    });
    const u2Login = await req('/api/auth/login', {
      method: 'POST',
      body: { usernameOrEmail: u2Name, password: 'pass1234' }
    });
    const user2Token = u2Login.data.accessToken;

    // Create a product with ONLY 1 item left in stock
    const scarceP = (await req('/api/admin/products', {
      method: 'POST',
      token: adminToken,
      body: { name: 'Món Hàng Cuối Cùng (Tier Test)', price: 99000, currentStock: 1, isActive: true }
    })).data;

    // Add to cart for user1 (DIAMOND/GOLD) and user2 (BRONZE)
    await req('/api/cart/add', { method: 'POST', token: userToken, body: { productId: scarceP.id, quantity: 1 } });
    await req('/api/cart/add', { method: 'POST', token: user2Token, body: { productId: scarceP.id, quantity: 1 } });

    // Submit simultaneously
    const [buy1, buy2] = await Promise.all([
      req('/api/orders', {
        method: 'POST',
        token: userToken,
        body: { shippingName: 'VIP User', shippingPhone: '0912345678', shippingAddress: 'VIP Addr', paymentMethod: 'COD' }
      }),
      req('/api/orders', {
        method: 'POST',
        token: user2Token,
        body: { shippingName: 'Bronze User', shippingPhone: '0912345678', shippingAddress: 'Bronze Addr', paymentMethod: 'COD' }
      })
    ]);

    // Wait for Worker
    await sleep(2000);
    const j1 = (await req(`/api/orders/jobs/${buy1.data.jobId}/status`, { token: userToken })).data;
    const j2 = (await req(`/api/orders/jobs/${buy2.data.jobId}/status`, { token: user2Token })).data;
    const finalStock = (await req(`/api/public/products/${scarceP.id}`)).data.currentStock;

    if (j1.status === 'SUCCEEDED' && j2.status === 'FAILED' && finalStock === 0) {
      logPass(8, `Tranh Chấp 3 Cấp Độ - Hội viên VIP thắng, hội viên Bronze bị từ chối, tồn kho chính xác = 0 (Không bán âm)`);
    } else {
      throw new Error(`Job1: ${j1.status}, Job2: ${j2.status}, Tồn kho: ${finalStock}`);
    }
  } catch (err) {
    logFail(8, 'Tranh Chấp 3 Cấp Độ', err);
  }

  console.log(`\n======================================================`);
  console.log(`HOÀN TẤT TOÀN BỘ BỘ TEST TỰ ĐỘNG!`);
  console.log(`======================================================\n`);
}

runAllTests().catch(err => {
  console.error('Lỗi khi chạy bộ kiểm thử:', err);
  process.exit(1);
});

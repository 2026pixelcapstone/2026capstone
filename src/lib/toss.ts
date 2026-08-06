import { loadTossPayments, ANONYMOUS } from '@tosspayments/tosspayments-sdk'
import { paymentApi } from '../api/paymentApi'

/**
 * 커미션 결제 시작 — 서버에서 orderId/금액을 받아 토스 "결제창"을 연다.
 *
 * ⚠️ 결제위젯(widgets)이 아니라 **결제창(payment window)** 방식이다.
 * 위젯 연동 키는 사업자 등록이 필요해 없고, 우리는 "API 개별 연동 키"(client/secret)를 쓴다.
 * 따라서 반드시 `tossPayments.payment().requestPayment()`를 사용한다(widgets() 금지).
 *
 * requestPayment가 성공하면 successUrl로 리다이렉트되고(그 페이지에서 서버 confirm),
 * 실패/취소 시 failUrl로 이동한다. 즉 이 함수 이후 흐름은 콜백 페이지가 이어받는다.
 */
export async function startCommissionPayment(commissionId: number): Promise<void> {
  const { data } = await paymentApi.prepareCommission(commissionId)
  const { orderId, amount, orderName, clientKey } = data.data

  const tossPayments = await loadTossPayments(clientKey)
  const payment = tossPayments.payment({ customerKey: ANONYMOUS })

  await payment.requestPayment({
    method: 'CARD',
    amount: { currency: 'KRW', value: amount },
    orderId,
    orderName,
    successUrl: `${window.location.origin}/payments/success`,
    failUrl: `${window.location.origin}/payments/fail`,
  })
}

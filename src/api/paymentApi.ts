import api from '../lib/axios'

/** 결제 준비 응답 — 결제창 requestPayment에 넘길 값(서버가 정본을 내려줌). */
export interface PaymentPrepareResponse {
  orderId: string
  amount: number
  orderName: string
  clientKey: string
}

/** 결제 승인 결과 — type으로 커미션/에셋 분기해 상세로 이동. */
export interface PaymentConfirmResult {
  type: 'COMMISSION' | 'ASSET'
  commissionId: number | null
  assetId: number | null
  paymentId: number
}

export const paymentApi = {
  /** 커미션 결제 준비(의뢰자·PENDING_PAYMENT) → orderId 발급 */
  prepareCommission: (commissionId: number) =>
    api.post<{ success: boolean; data: PaymentPrepareResponse }>(
      `/api/payments/commission/${commissionId}/prepare`),

  /** 에셋 결제 준비(유료·미구매) → orderId 발급 */
  prepareAsset: (assetId: number) =>
    api.post<{ success: boolean; data: PaymentPrepareResponse }>(
      `/api/payments/asset/${assetId}/prepare`),

  /** 결제 승인 — 토스 인증 후 successUrl에서 돌아온 값 전달 */
  confirm: (body: { paymentKey: string; orderId: string; amount: number }) =>
    api.post<{ success: boolean; data: PaymentConfirmResult }>(
      '/api/payments/confirm', body),
}

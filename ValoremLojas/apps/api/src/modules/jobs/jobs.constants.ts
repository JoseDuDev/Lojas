export const QUEUE_EMAIL = 'email'
export const QUEUE_SEARCH = 'search-index'

export const JOB_EMAIL_ORDER_CONFIRMATION = 'order-confirmation'
export const JOB_EMAIL_PAYMENT_CONFIRMED = 'payment-confirmed'
export const JOB_EMAIL_NEW_ORDER_ALERT = 'new-order-alert'
export const JOB_EMAIL_UPGRADE_REQUEST = 'upgrade-request'

export const JOB_SEARCH_INDEX_PRODUCT = 'index-product'
export const JOB_SEARCH_DELETE_PRODUCT = 'delete-product'
export const JOB_SEARCH_REINDEX_STORE = 'reindex-store'

export const JOB_DEFAULT_OPTS = {
  attempts: 3,
  backoff: { type: 'exponential', delay: 2000 },
  removeOnComplete: true,
  removeOnFail: 50,
} as const

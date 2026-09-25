import {createHmac, randomBytes, createCipheriv, createDecipheriv} from 'node:crypto';
import {parsePhoneNumberFromString} from 'libphonenumber-js';

export function normalizePhone(value) {
  if (typeof value !== 'string' || !value.trim().startsWith('+')) throw Object.assign(new Error('Include your country code, for example +1.'), {status:400});
  const phone = parsePhoneNumberFromString(value.trim());
  if (!phone?.isValid()) throw Object.assign(new Error('Enter a valid mobile number with its country code.'), {status:400});
  return phone.number;
}
export const fingerprint = (value, key) => createHmac('sha256', key).update(value).digest('hex');
export function seal(value, key) {
  const iv = randomBytes(12), cipher = createCipheriv('aes-256-gcm', Buffer.from(key, 'hex'), iv);
  const body = Buffer.concat([cipher.update(JSON.stringify(value)), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), body]).toString('base64');
}
export function unseal(value, key) {
  const bytes=Buffer.from(value,'base64'), decipher=createDecipheriv('aes-256-gcm',Buffer.from(key,'hex'),bytes.subarray(0,12));
  decipher.setAuthTag(bytes.subarray(12,28));
  return JSON.parse(Buffer.concat([decipher.update(bytes.subarray(28)),decipher.final()]).toString());
}
export function entitlement(subscriptions, priceId, now=Math.floor(Date.now()/1000)) {
  const matching = subscriptions.filter(s => s.items?.data.some(i => i.price.id === priceId));
  const current = matching.find(s => s.status === 'trialing' && s.trial_end > now) || matching.find(s => s.status === 'active' && s.latest_invoice?.status === 'paid' && s.items.data.some(i=>i.price.id===priceId && (i.current_period_end || s.current_period_end)>now));
  const pending = matching.find(s=>!['canceled','incomplete_expired'].includes(s.status));
  const chosen=current||pending||matching[0];
  return {access:!!current, status:chosen?.status||'not_started', trialUsed:matching.some(s=>!!s.trial_start), subscriptionId:chosen?.id||null, trialEnd:chosen?.trial_end||null, periodEnd:chosen?.items?.data.find(i=>i.price.id===priceId)?.current_period_end||chosen?.current_period_end||null, cancelAtPeriodEnd:!!chosen?.cancel_at_period_end, pending:!!pending};
}
export function assertPrice(price) {
  if (!price.active || price.currency !== 'usd' || price.unit_amount !== 1500 || price.recurring?.interval !== 'month' || price.recurring?.interval_count !== 1 || price.recurring?.usage_type !== 'licensed') throw new Error('STRIPE_PRICE_ID must be an active USD $15/month licensed price.');
}
export function checkoutParameters(config, account, attempt, customer) {
  return {mode:'subscription', customer, client_reference_id:account.user_id,
    line_items:[{price:config.priceId,quantity:1}], payment_method_types:['card'], payment_method_collection:'always',
    success_url:config.origin+'/commerce.html?checkout=success',cancel_url:config.origin+'/commerce.html?checkout=canceled',
    consent_collection:{terms_of_service:'required'}, billing_address_collection:'required',
    automatic_tax:{enabled:config.automaticTax}, customer_update:{address:'auto'},
    metadata:{specly_user_id:account.user_id,attempt_id:attempt.id,terms_version:config.termsVersion},
    subscription_data:{metadata:{specly_user_id:account.user_id},...(attempt.trial?{trial_period_days:3,trial_settings:{end_behavior:{missing_payment_method:'cancel'}}}:{})},
    custom_text:{submit:{message:attempt.trial?'3 days free, then US$15/month plus applicable tax until canceled. Cancel before your trial ends to avoid the first charge.':'US$15/month plus applicable tax until canceled. No additional free trial.'}}};
}

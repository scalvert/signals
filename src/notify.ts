import nodemailer from 'nodemailer'
import { digestSubject, renderEmailHtml, renderSlackText } from './render'
import type { SignalsConfig } from './config'
import type { SignalsState } from './types'

/** Send the ranked digest to whatever channels are enabled in config (and have their secret set). */
export async function notify(config: SignalsConfig, state: SignalsState): Promise<void> {
  await Promise.all([sendSlack(config, state), sendEmail(config, state)])
}

async function sendSlack(config: SignalsConfig, state: SignalsState): Promise<void> {
  if (!config.notifications.slack.enabled) return
  const webhook = process.env.SIGNALS_SLACK_WEBHOOK
  if (!webhook) {
    console.warn('[signals] slack enabled but SIGNALS_SLACK_WEBHOOK is not set — skipping')
    return
  }
  const res = await fetch(webhook, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ text: renderSlackText(state, config.digest.topN) }),
  })
  if (!res.ok) console.error(`[signals] slack post failed: ${res.status} ${res.statusText}`)
  else console.error('[signals] slack digest sent')
}

async function sendEmail(config: SignalsConfig, state: SignalsState): Promise<void> {
  const { enabled, to, from } = config.notifications.email
  if (!enabled) return
  const smtpUrl = process.env.SIGNALS_SMTP_URL
  if (!smtpUrl || !to) {
    console.warn('[signals] email enabled but SIGNALS_SMTP_URL or notifications.email.to is missing — skipping')
    return
  }
  const transport = nodemailer.createTransport(smtpUrl)
  await transport.sendMail({
    from: from || to,
    to,
    subject: digestSubject(state, config.digest.topN),
    html: renderEmailHtml(state, config.digest.topN),
  })
  console.error('[signals] email digest sent')
}

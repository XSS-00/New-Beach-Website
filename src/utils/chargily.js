// For production, Chargily checkout creation should be proxied through a small
// backend/serverless function so the secret API key is never exposed in the
// browser. This client-only version is a functional prototype for this static app.
export async function createChargilyCheckout({
  apiKey,
  amount,
  reservationCode,
  customerName,
  customerEmail,
  successUrl,
  failureUrl,
  locale = 'fr',
}) {
  if (!apiKey) throw new Error('Missing Chargily API key');

  const baseUrl = apiKey.toLowerCase().includes('test')
    ? 'https://pay.chargily.net/test/api/v2'
    : 'https://pay.chargily.net/api/v2';

  const response = await fetch(`${baseUrl}/checkouts`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      amount,
      currency: 'dzd',
      payment_method: 'edahabia',
      success_url: successUrl,
      failure_url: failureUrl,
      description: `New Beach Oran - Reservation ${reservationCode}`,
      locale,
      metadata: { reservationCode, customerName, customerEmail },
    }),
  });

  if (!response.ok) throw new Error('Checkout creation failed');
  return response.json();
}

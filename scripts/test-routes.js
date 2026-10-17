async function runRouteTests() {
  const rootUrl = 'http://localhost:3000/';
  const dashboardUrl = 'http://localhost:3000/dashboard';

  console.log('--- TEST 1: Requesting public root "/" path ---');
  try {
    const res = await fetch(rootUrl);
    console.log('Status:', res.status);
    const text = await res.text();
    const hasSlogan = text.includes('AI-Powered SaaS Spend Tracking for Agencies');
    console.log('Includes marketing hero text:', hasSlogan ? 'YES (Public access verified!)' : 'NO');
  } catch (err) {
    console.error('Test 1 failed:', err.message);
  }

  console.log('\n--- TEST 2: Requesting protected "/dashboard" path ---');
  try {
    // We disable redirect following to inspect if Clerk issues a redirect
    const res = await fetch(dashboardUrl, { redirect: 'manual' });
    console.log('Status:', res.status);
    console.log('Redirect Header (Location):', res.headers.get('location'));
    const isRedirectedToClerk = res.status === 307 || (res.headers.get('location') && res.headers.get('location').includes('clerk'));
    console.log('Intercepted and redirected by Clerk auth:', isRedirectedToClerk ? 'YES (Protected route verified!)' : 'NO');
  } catch (err) {
    console.error('Test 2 failed:', err.message);
  }
}

runRouteTests();

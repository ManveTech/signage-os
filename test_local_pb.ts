async function testLocalPb() {
  const urls = ['http://localhost:8090', 'http://127.0.0.1:8090'];
  for (const url of urls) {
    try {
      const res = await fetch(url);
      console.log(`Connection to ${url} succeeded! Status:`, res.status);
    } catch (err: any) {
      console.log(`Connection to ${url} failed:`, err.message);
    }
  }
}

testLocalPb();

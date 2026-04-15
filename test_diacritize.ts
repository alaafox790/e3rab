async function run() {
  try {
    const response = await fetch('http://localhost:3000/api/diacritize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: 'مرحبا' })
    });
    console.log(response.status);
    console.log(await response.text());
  } catch (e) {
    console.error(e);
  }
}
run();

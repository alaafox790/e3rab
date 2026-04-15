async function run() {
  try {
    const response = await fetch('http://localhost:3000/api/health');
    console.log(response.status);
    console.log(await response.text());
  } catch (e) {
    console.error(e);
  }
}
run();

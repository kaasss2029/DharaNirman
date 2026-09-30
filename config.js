// DharaNirman Global Frontend Configuration
// When deploying to Render/Vercel/Netlify, set your deployed backend URL here if needed.
// If left as window.location.hostname logic, it auto-detects localhost vs production.

window.CONFIG = {
  // Replace with your Render backend URL once deployed, e.g. "https://dharanirman-backend.onrender.com"
  API_BASE_URL: window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://127.0.0.1:8000'
    : 'https://dharanirman-backend.onrender.com'
};

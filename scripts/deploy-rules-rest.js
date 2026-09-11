const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');
const { GoogleAuth } = require('google-auth-library');

const serviceAccount = require('../serviceAccountKey.json');

async function deployRules() {
  const rulesPath = path.join(__dirname, '..', 'firestore.rules');
  const rules = fs.readFileSync(rulesPath, 'utf8');
  const projectId = serviceAccount.project_id;

  const auth = new GoogleAuth({
    credentials: serviceAccount,
    scopes: ['https://www.googleapis.com/auth/datastore']
  });

  const client = await auth.getClient();
  const tokenResponse = await client.getAccessToken();
  const accessToken = tokenResponse.token || tokenResponse;

  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default):testRules`;

  const body = JSON.stringify({
    source: {
      files: [{
        content: rules
      }]
    }
  });

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: body
  });

  const result = await response.text();

  if (response.ok) {
    console.log('✅ Reglas validadas correctamente');
    console.log(result);
  } else {
    console.error('❌ Error:', response.status, result);
  }

  process.exit(0);
}

deployRules();

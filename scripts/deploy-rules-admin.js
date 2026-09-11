const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

const serviceAccount = require('../serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const firestore = admin.firestore();

async function deployRules() {
  const rulesPath = path.join(__dirname, '..', 'firestore.rules');
  const rules = fs.readFileSync(rulesPath, 'utf8');
  
  // Extract the rules content between the service block
  const match = rules.match(/service cloud\.firestore\s*{([\s\S]*)}/);
  if (!match) {
    console.error('Invalid rules format');
    process.exit(1);
  }
  
  const rulesContent = match[1].trim();
  
  try {
    // Use the REST API to update rules
    const projectId = serviceAccount.project_id;
    const accessToken = await admin.credential.cert(serviceAccount).getAccessToken();
    
    const response = await fetch(
      `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/rules`,
      {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${accessToken.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          source: {
            files: [{
              content: `rules_version = '2';\nservice cloud.firestore {\n  match /databases/{database}/documents {\n    match /{document=**} {\n      allow read, write: if request.auth != null;\n    }\n  }\n}`
            }]
          }
        })
      }
    );
    
    if (response.ok) {
      console.log('Rules deployed successfully!');
    } else {
      const error = await response.text();
      console.error('Deploy failed:', error);
    }
  } catch (error) {
    console.error('Error:', error.message);
  }
  
  process.exit(0);
}

deployRules();

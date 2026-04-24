// One-time script to get your Google OAuth refresh token.
// Run once: node scripts/getGoogleToken.js
// Then copy the refresh token into your .env file.

require('dotenv').config()
const { google } = require('googleapis')
const readline = require('readline')

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  'urn:ietf:wg:oauth:2.0:oob'
)

const authUrl = oauth2Client.generateAuthUrl({
  access_type: 'offline',
  scope: ['https://www.googleapis.com/auth/calendar.readonly']
})

console.log('\n1. Open this URL in your browser:\n')
console.log(authUrl)
console.log('\n2. Sign in and click Allow.')
console.log('3. Copy the code Google gives you and paste it below.\n')

const rl = readline.createInterface({ input: process.stdin, output: process.stdout })

rl.question('Paste the code here: ', async (code) => {
  rl.close()
  const { tokens } = await oauth2Client.getToken(code.trim())
  console.log('\nAdd this to your .env file:')
  console.log(`GOOGLE_REFRESH_TOKEN=${tokens.refresh_token}`)
})

const express = require('express');
const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const app = express();
const PORT = 3000;
const DB_FILE = path.join(__dirname, 'leads.json');

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Helper to read/write leads (acts as a local database so no MongoDB setup is required)
function getLeads() {
if (!fs.existsSync(DB_FILE)) return [];
return JSON.parse(fs.readFileSync(DB_FILE, 'utf-8'));
}

function saveLeads(leads) {
fs.writeFileSync(DB_FILE, JSON.stringify(leads, null, 2));
}

// Sign-up API Route
app.post('/api/signup', async (req, res) => {
try {
const { name, email, company, plan } = req.body;

if (!name || !email || !email.includes('@')) {
return res.status(400).json({ error: 'Please enter a valid name and email address.' });
}

const leads = getLeads();
const token = crypto.randomBytes(16).toString('hex');

const newLead = {
id: Date.now(),
name,
email,
company: company || 'Personal',
plan: plan || 'Starter',
verified: false,
token,
createdAt: new Date().toLocaleString()
};

leads.push(newLead);
saveLeads(leads);

// Automatically creates a free Nodemailer test email account (Zero API keys required!)
const testAccount = await nodemailer.createTestAccount();
const transporter = nodemailer.createTransport({
host: 'smtp.ethereal.email',
port: 587,
secure: false,
auth: {
user: testAccount.user,
pass: testAccount.pass
}
});

const verifyLink = `http://localhost:${PORT}/api/verify/${token}`;

const info = await transporter.sendMail({
from: '"CloudFlow SaaS" <no-reply@cloudflow.io>',
to: email,
subject: 'Verify your CloudFlow SaaS Account',
html: `
<div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #ddd; border-radius: 10px;">
<h2 style="color: #4f46e5;">Welcome to CloudFlow, ${name}!</h2>
<p>Thank you for signing up for the <b>${newLead.plan}</b> plan.</p>
<p>Click the button below to verify your email address:</p>
<a href="${verifyLink}" style="display: inline-block; padding: 10px 20px; background: #4f46e5; color: #fff; text-decoration: none; border-radius: 6px;">Verify Email Now</a>
</div>
`
});

const emailPreviewUrl = nodemailer.getTestMessageUrl(info);
console.log('Verification Email Sent! Preview URL:', emailPreviewUrl);

res.json({
message: 'Sign up successful! Verification email sent.',
lead: newLead,
emailPreviewUrl,
totalLeads: leads.length
});
} catch (err) {
console.error(err);
res.status(500).json({ error: 'Server error while signing up.' });
}
});

// Email Verification Route
app.get('/api/verify/:token', (req, res) => {
const leads = getLeads();
const lead = leads.find(l => l.token === req.params.token);

if (!lead) {
return res.status(400).send('<h2>Invalid verification token.</h2>');
}

lead.verified = true;
saveLeads(leads);

res.send(`
<div style="font-family: sans-serif; text-align: center; margin-top: 80px;">
<h1 style="color: #16a34a;">✅ Email Verified Successfully!</h1>
<p>Thank you, <b>${lead.name}</b> (${lead.email}). Your CloudFlow SaaS account is now active.</p>
<a href="/" style="color: #4f46e5; font-weight: bold;">Return to Dashboard</a>
</div>
`);
});

app.listen(PORT, () => {
console.log(`✅ Project 10 Server running at http://localhost:${PORT}`);
});
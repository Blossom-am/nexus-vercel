const nodemailer = require('nodemailer');

module.exports = async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // Auth check
  var auth = req.headers.authorization;
  if (auth !== 'Bearer nexus2026') return res.status(401).json({ error: 'Unauthorized' });

  try {
    var body = req.body;
    var to = body.to;
    var agentName = body.agentName;
    var lot = body.lot;
    var ville = body.ville;
    var oldStatus = body.oldStatus;
    var newStatus = body.newStatus;
    var changeType = body.changeType;

    if (!to || !lot || !changeType) {
      return res.status(400).json({ error: 'Missing required fields: to, lot, changeType' });
    }

    // Build email subject and body based on change type
    var subject = '';
    var htmlBody = '';
    var statusColor = '';

    switch (changeType) {
      case 'option_placed':
        subject = 'Nexus - Lot ' + lot + ' (' + ville + ') : Sous Option';
        statusColor = '#F59E0B';
        htmlBody = buildEmail(agentName, lot, ville, 'est pass\u00e9 sous Option', statusColor, 'Un prescripteur a plac\u00e9 une option sur ce lot. L\'option expire dans 10 minutes.');
        break;
      case 'option_expired':
        subject = 'Nexus - Lot ' + lot + ' (' + ville + ') : Option expir\u00e9e - Disponible';
        statusColor = '#3B82F6';
        htmlBody = buildEmail(agentName, lot, ville, 'est de nouveau Disponible (option expir\u00e9e)', statusColor, 'L\'option sur ce lot a expir\u00e9. Le lot est de nouveau disponible \u00e0 la commercialisation.');
        break;
      case 'became_unavailable':
        subject = 'Nexus - Lot ' + lot + ' (' + ville + ') : ' + newStatus;
        statusColor = '#EF4444';
        htmlBody = buildEmail(agentName, lot, ville, 'n\'est plus disponible (' + newStatus + ')', statusColor, 'Le statut de commercialisation de ce lot a chang\u00e9. Il n\'est plus disponible.');
        break;
      case 'became_available':
        subject = 'Nexus - Lot ' + lot + ' (' + ville + ') : Disponible';
        statusColor = '#3B82F6';
        htmlBody = buildEmail(agentName, lot, ville, 'est de nouveau Disponible', statusColor, 'Ce lot est de nouveau disponible \u00e0 la commercialisation.');
        break;
      default:
        return res.status(400).json({ error: 'Unknown changeType: ' + changeType });
    }

    // Send email via SMTP
    var transporter = nodemailer.createTransport({
      host: 'smtp.office365.com',
      port: 587,
      secure: false,
      auth: {
        user: process.env.SMTP_USER || 'Nexus@blossom-am.com',
        pass: process.env.SMTP_PASS
      },
      tls: { ciphers: 'SSLv3', rejectUnauthorized: false }
    });

    await transporter.sendMail({
      from: '"Nexus Dashboard" <Nexus@blossom-am.com>',
      to: to,
      subject: subject,
      html: htmlBody
    });

    return res.status(200).json({ ok: true, sent: to, changeType: changeType });
  } catch (err) {
    console.error('Notify error:', err);
    return res.status(500).json({ error: err.message });
  }
};

function buildEmail(agentName, lot, ville, statusText, color, detail) {
  return '<!DOCTYPE html><html><body style="font-family:Arial,sans-serif;margin:0;padding:0;background:#f5f5f5;">' +
    '<div style="max-width:600px;margin:20px auto;background:white;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.1);">' +
    '<div style="background:#1e3a5f;padding:20px 30px;">' +
    '<h1 style="color:white;margin:0;font-size:22px;">Nexus</h1>' +
    '<p style="color:#94a3b8;margin:4px 0 0;font-size:13px;">Notification de commercialisation</p>' +
    '</div>' +
    '<div style="padding:30px;">' +
    '<p style="color:#334155;font-size:15px;margin:0 0 15px;">Bonjour ' + (agentName || '') + ',</p>' +
    '<div style="background:#f8fafc;border-left:4px solid ' + color + ';padding:15px 20px;margin:15px 0;border-radius:0 6px 6px 0;">' +
    '<p style="margin:0;font-size:16px;font-weight:600;color:#1e293b;">Lot ' + lot + ' \u2014 ' + (ville || '') + '</p>' +
    '<p style="margin:8px 0 0;font-size:15px;color:' + color + ';font-weight:600;">' + statusText + '</p>' +
    '</div>' +
    '<p style="color:#64748b;font-size:14px;margin:15px 0;">' + detail + '</p>' +
    '<hr style="border:none;border-top:1px solid #e2e8f0;margin:25px 0;">' +
    '<p style="color:#94a3b8;font-size:12px;margin:0;">Cet email a \u00e9t\u00e9 envoy\u00e9 automatiquement par le tableau de bord Nexus.</p>' +
    '</div></div></body></html>';
  }

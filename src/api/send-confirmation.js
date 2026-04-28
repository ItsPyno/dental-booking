module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();

  const { patientName, patientEmail, service, dentist, date, time } = req.body;

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: "DentaBook AI <conorpyne@dentabook.ie>",
        to: [patientEmail],
        subject: "Your appointment is confirmed!",
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: linear-gradient(135deg, #0ea5e9, #14b8a6); padding: 32px; text-align: center; border-radius: 12px 12px 0 0;">
              <h1 style="color: white; margin: 0; font-size: 24px;">🦷 Appointment Confirmed!</h1>
            </div>
            <div style="padding: 32px; background: #f8fafc; border-radius: 0 0 12px 12px;">
              <p style="font-size: 16px; color: #0f172a;">Hi <strong>${patientName}</strong>,</p>
              <p style="color: #64748b;">Your appointment has been confirmed. Here are your details:</p>
              <div style="background: white; border-radius: 8px; padding: 20px; margin: 20px 0; border: 1px solid #e2e8f0;">
                <table style="width: 100%; border-collapse: collapse;">
                  <tr style="border-bottom: 1px solid #f1f5f9;">
                    <td style="padding: 10px 0; color: #94a3b8; font-size: 14px;">Service</td>
                    <td style="padding: 10px 0; color: #0f172a; font-weight: bold; font-size: 14px;">${service}</td>
                  </tr>
                  <tr style="border-bottom: 1px solid #f1f5f9;">
                    <td style="padding: 10px 0; color: #94a3b8; font-size: 14px;">Dentist</td>
                    <td style="padding: 10px 0; color: #0f172a; font-weight: bold; font-size: 14px;">${dentist}</td>
                  </tr>
                  <tr style="border-bottom: 1px solid #f1f5f9;">
                    <td style="padding: 10px 0; color: #94a3b8; font-size: 14px;">Date</td>
                    <td style="padding: 10px 0; color: #0f172a; font-weight: bold; font-size: 14px;">${date}</td>
                  </tr>
                  <tr>
                    <td style="padding: 10px 0; color: #94a3b8; font-size: 14px;">Time</td>
                    <td style="padding: 10px 0; color: #0f172a; font-weight: bold; font-size: 14px;">${time}</td>
                  </tr>
                </table>
              </div>
              <p style="color: #64748b; font-size: 14px;">Need to cancel or reschedule? Please contact us at least 24 hours before your appointment.</p>
              <p style="color: #94a3b8; font-size: 12px; margin-top: 32px;">Powered by DentaBook AI · dentabook.ie</p>
            </div>
          </div>
        `
      })
    });

    const data = await response.json();
    res.status(200).json({ success: true });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
}

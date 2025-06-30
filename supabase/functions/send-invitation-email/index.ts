import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

interface InvitationEmailRequest {
  invitee_email: string
  invitee_name: string
  inviter_name: string
  hours: number
  mode: string
  invitation_token: string
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { 
      invitee_email, 
      invitee_name, 
      inviter_name, 
      hours, 
      mode, 
      invitation_token 
    }: InvitationEmailRequest = await req.json()

    console.log('📧 Email function called with:', {
      invitee_email,
      invitee_name,
      inviter_name,
      hours,
      mode,
      invitation_token: invitation_token ? `${invitation_token.substring(0, 8)}...` : 'missing'
    })

    if (!invitee_email || !invitee_name || !inviter_name || !hours || !mode || !invitation_token) {
      const missingFields = {
        invitee_email: !invitee_email,
        invitee_name: !invitee_name,
        inviter_name: !inviter_name,
        hours: !hours,
        mode: !mode,
        invitation_token: !invitation_token
      }
      console.error('❌ Missing required fields:', missingFields)
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Missing required fields',
          missing_fields: missingFields
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Get environment variables
    const resendApiKey = Deno.env.get('RESEND_API_KEY')
    const siteUrl = Deno.env.get('SITE_URL') || 'http://localhost:5173'
    
    console.log('🔧 Environment check:', {
      hasResendKey: !!resendApiKey,
      resendKeyLength: resendApiKey?.length || 0,
      siteUrl
    })
    
    if (!resendApiKey) {
      console.error('❌ RESEND_API_KEY not found in environment')
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Email service not configured - RESEND_API_KEY missing',
          message: 'The email service is not properly configured. Please contact support.'
        }),
        { 
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    const inviteUrl = `${siteUrl}/invite/${invitation_token}`
    console.log('🔗 Generated invite URL:', inviteUrl)

    // Generate email content
    const actionText = mode === 'helped' ? 'helped you' : 'you helped them'
    const subject = `${inviter_name} wants to track time with you on Yard`
    
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${subject}</title>
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background-color: #fbbf24; padding: 30px; border-radius: 20px; text-align: center; margin-bottom: 30px;">
          <h1 style="font-size: 32px; font-weight: bold; color: black; font-style: italic; margin: 0;">yard</h1>
        </div>
        
        <h2 style="color: #1f2937; margin-bottom: 20px;">You're invited to join Yard!</h2>
        
        <p style="font-size: 16px; margin-bottom: 15px;">Hi ${invitee_name},</p>
        
        <div style="background-color: #fef3c7; border: 1px solid #f59e0b; border-radius: 12px; padding: 20px; margin: 20px 0;">
          <p style="margin: 0; color: #92400e;">
            <strong>⏰ Time Log Waiting for You</strong><br>
            <strong>${inviter_name}</strong> wants to track <strong>${hours} hour${hours !== 1 ? 's' : ''}</strong> where ${actionText} on Yard.
          </p>
        </div>
        
        <p style="font-size: 16px; margin-bottom: 25px;">
          Yard is a professional time tracking and networking platform where time becomes currency and expertise flows freely through your network.
        </p>
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="${inviteUrl}" style="background-color: #000; color: white; padding: 15px 30px; text-decoration: none; border-radius: 12px; display: inline-block; font-weight: 600; font-size: 16px;">Join Yard & Confirm Time</a>
        </div>
        
        <p style="font-size: 14px; color: #6b7280; margin-top: 30px;">
          If the button doesn't work, copy and paste this link into your browser:<br>
          <a href="${inviteUrl}" style="color: #3b82f6; word-break: break-all;">${inviteUrl}</a>
        </p>
        
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
        
        <p style="font-size: 14px; color: #6b7280;">
          Best regards,<br>
          The Yard Team
        </p>
      </body>
      </html>
    `

    const textContent = `
Hi ${invitee_name},

${inviter_name} wants to track ${hours} hour${hours !== 1 ? 's' : ''} of time where ${actionText} on Yard.

Yard is a professional time tracking and networking platform where time becomes currency and expertise flows freely through your network.

Click this link to join Yard and confirm the time:
${inviteUrl}

If the link doesn't work, copy and paste it into your browser.

Best regards,
The Yard Team
    `.trim()

    // Prepare email payload - try different from addresses
    const emailPayloads = [
      {
        from: 'Yard <noreply@yard.app>',
        to: [invitee_email],
        subject: subject,
        html: htmlContent,
        text: textContent
      },
      {
        from: 'Yard <onboarding@resend.dev>',
        to: [invitee_email],
        subject: subject,
        html: htmlContent,
        text: textContent
      },
      {
        from: 'noreply@yard.app',
        to: [invitee_email],
        subject: subject,
        html: htmlContent,
        text: textContent
      }
    ]

    console.log('📤 Attempting to send email...')

    let lastError = null
    let emailResult = null

    // Try different from addresses
    for (let i = 0; i < emailPayloads.length; i++) {
      const payload = emailPayloads[i]
      console.log(`📮 Attempt ${i + 1}: Trying from address: ${payload.from}`)

      try {
        const emailResponse = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${resendApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload)
        })

        console.log(`📬 Resend API response status (attempt ${i + 1}):`, emailResponse.status)
        
        emailResult = await emailResponse.json()
        console.log(`📬 Resend API response (attempt ${i + 1}):`, emailResult)

        if (emailResponse.ok) {
          console.log('✅ Email sent successfully!')
          return new Response(
            JSON.stringify({ 
              success: true, 
              message: 'Invitation email sent successfully!',
              invite_url: inviteUrl,
              email_id: emailResult.id,
              from_address: payload.from
            }),
            { 
              headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
            }
          )
        } else {
          lastError = emailResult
          console.log(`❌ Attempt ${i + 1} failed:`, emailResult)
        }
      } catch (fetchError) {
        console.error(`💥 Fetch error on attempt ${i + 1}:`, fetchError)
        lastError = { error: fetchError.message }
      }
    }

    // All attempts failed
    console.error('❌ All email sending attempts failed')
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: 'Email delivery failed after multiple attempts',
        message: 'Unable to send email invitation. The invitation link is still valid.',
        invite_url: inviteUrl,
        last_error: lastError,
        attempts_made: emailPayloads.length
      }),
      { 
        status: 200, // Return 200 so the invitation is still created
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('💥 Critical error in send-invitation-email function:', error)
    
    return new Response(
      JSON.stringify({ 
        success: false,
        error: 'Email function error',
        message: error.message,
        stack: error.stack
      }),
      { 
        status: 200, // Return 200 so the invitation is still created
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})
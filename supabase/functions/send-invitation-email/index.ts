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
          message: 'The email service is not properly configured. Please contact support.',
          invite_url: `${siteUrl}/invite/${invitation_token}`
        }),
        { 
          status: 200,
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

    // Use the correct verified domain format for Resend
    // Based on your Resend dashboard, use the exact format that works
    const fromAddress = 'aleena@publics.world'
    
    console.log(`📤 Sending email from verified domain: ${fromAddress}`)
    
    const emailPayload = {
      from: fromAddress,
      to: [invitee_email],
      subject: subject,
      html: htmlContent,
      text: textContent
    }

    console.log('📬 Email payload:', {
      from: emailPayload.from,
      to: emailPayload.to,
      subject: emailPayload.subject,
      hasHtml: !!emailPayload.html,
      hasText: !!emailPayload.text
    })

    const emailResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(emailPayload)
    })

    console.log(`📬 Resend API response status:`, emailResponse.status)
    
    const emailResult = await emailResponse.json()
    console.log(`📬 Resend API response:`, emailResult)

    if (emailResponse.ok) {
      console.log(`✅ Email sent successfully!`)
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Invitation email sent successfully!',
          invite_url: inviteUrl,
          email_id: emailResult.id
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    } else {
      console.error('❌ Resend API error:', emailResult)
      
      // Return detailed error information
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Email delivery failed',
          message: `Unable to send email: ${emailResult.message || 'Unknown error'}. The invitation link is still valid.`,
          invite_url: inviteUrl,
          resend_error: emailResult,
          status_code: emailResponse.status
        }),
        { 
          status: 200, // Return 200 so the invitation is still created
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

  } catch (error) {
    console.error('💥 Critical error in send-invitation-email function:', error)
    
    const siteUrl = Deno.env.get('SITE_URL') || 'http://localhost:5173'
    const inviteUrl = `${siteUrl}/invite/${invitation_token || 'unknown'}`
    
    return new Response(
      JSON.stringify({ 
        success: false,
        error: 'Email function error',
        message: 'Unable to send email invitation. The invitation link is still valid.',
        invite_url: inviteUrl,
        function_error: error.message
      }),
      { 
        status: 200, // Return 200 so the invitation is still created
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})
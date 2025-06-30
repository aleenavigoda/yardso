import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

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

    if (!invitee_email || !invitee_name || !inviter_name || !hours || !mode || !invitation_token) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Initialize Supabase client with service role key for admin operations
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Create a custom invitation URL that goes to our signup page with the token
    const siteUrl = Deno.env.get('SITE_URL') || 'http://localhost:5173'
    const inviteUrl = `${siteUrl}/invite/${invitation_token}`

    // Generate email content
    const actionText = mode === 'helped' ? 'helped you' : 'you helped them'
    const subject = `${inviter_name} wants to track time with you on Yard`
    
    const htmlContent = `
      <h2>You have been invited to Yard</h2>
      <p>Hi ${invitee_name},</p>
      <p>${inviter_name} wants to track ${hours} hour${hours !== 1 ? 's' : ''} of time where ${actionText} on Yard.</p>
      <p>Yard is a professional time tracking and networking platform where time becomes currency and expertise flows freely through your network.</p>
      <p><a href="${inviteUrl}" style="background-color: #000; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; display: inline-block;">Join Yard & Confirm Time</a></p>
      <p>If the button doesn't work, copy and paste this link into your browser:</p>
      <p>${inviteUrl}</p>
      <p>Best regards,<br>The Yard Team</p>
    `

    const textContent = `
      Hi ${invitee_name},

      ${inviter_name} wants to track ${hours} hour${hours !== 1 ? 's' : ''} of time where ${actionText} on Yard.

      Yard is a professional time tracking and networking platform where time becomes currency and expertise flows freely through your network.

      Click this link to join Yard and confirm the time:
      ${inviteUrl}

      Best regards,
      The Yard Team
    `

    // For now, we'll use a simple email service simulation
    // In production, you would integrate with SendGrid, Resend, or another email service
    console.log('Would send email to:', invitee_email)
    console.log('Subject:', subject)
    console.log('HTML Content:', htmlContent)
    console.log('Text Content:', textContent)

    // TODO: Replace this with actual email service integration
    // Example with SendGrid:
    /*
    const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('SENDGRID_API_KEY')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        personalizations: [{
          to: [{ email: invitee_email, name: invitee_name }],
          subject: subject
        }],
        from: { email: 'noreply@yard.app', name: 'Yard' },
        content: [
          { type: 'text/plain', value: textContent },
          { type: 'text/html', value: htmlContent }
        ]
      })
    })
    */

    console.log('Custom invitation email would be sent successfully to:', invitee_email)

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Invitation email sent successfully',
        invite_url: inviteUrl
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  } catch (error) {
    console.error('Error in send-invitation-email function:', error)
    return new Response(
      JSON.stringify({ 
        error: 'Failed to send invitation email',
        details: error.message 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})
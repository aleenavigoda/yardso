import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

interface InvitationRequest {
  contact: string
  name: string
  inviterName: string
  hours: number
  mode: string
  type: 'email' | 'sms'
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { contact, name, inviterName, hours, mode, type }: InvitationRequest = await req.json()

    if (!contact || !name || !inviterName || !hours || !mode || !type) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Generate invitation message
    const actionText = mode === 'helped' ? 'helped you' : 'you helped them'
    const message = `Hi ${name}! ${inviterName} wants to track ${hours} hour${hours !== 1 ? 's' : ''} of time where ${actionText} on Yard. Join your workyard to confirm: https://yard.app/invite`

    if (type === 'email') {
      // In a real app, you would integrate with an email service like SendGrid, Resend, etc.
      console.log(`Would send email to ${contact}: ${message}`)
      
      // For demo purposes, we'll just log the email
      // In production, you would call your email service API here
      /*
      const emailResponse = await fetch('https://api.sendgrid.com/v3/mail/send', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${Deno.env.get('SENDGRID_API_KEY')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          personalizations: [{
            to: [{ email: contact, name: name }],
            subject: `${inviterName} wants to track time with you on Yard`
          }],
          from: { email: 'noreply@yard.app', name: 'Yard' },
          content: [{
            type: 'text/plain',
            value: message
          }]
        })
      })
      */
    } else {
      // In a real app, you would integrate with an SMS service like Twilio
      console.log(`Would send SMS to ${contact}: ${message}`)
      
      // For demo purposes, we'll just log the SMS
      // In production, you would call your SMS service API here
      /*
      const smsResponse = await fetch('https://api.twilio.com/2010-04-01/Accounts/YOUR_ACCOUNT_SID/Messages.json', {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${btoa(`${Deno.env.get('TWILIO_ACCOUNT_SID')}:${Deno.env.get('TWILIO_AUTH_TOKEN')}`)}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          From: Deno.env.get('TWILIO_PHONE_NUMBER') || '+1234567890',
          To: contact,
          Body: message
        })
      })
      */
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `${type === 'email' ? 'Email' : 'SMS'} invitation sent successfully` 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  } catch (error) {
    console.error('Error sending invitation:', error)
    return new Response(
      JSON.stringify({ error: 'Failed to send invitation' }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})
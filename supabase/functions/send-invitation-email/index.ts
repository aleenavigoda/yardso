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

    // Create the invitation URL
    const inviteUrl = `${Deno.env.get('SUPABASE_URL')?.replace('/rest/v1', '')}/auth/v1/verify?token=${invitation_token}&type=invite&redirect_to=${encodeURIComponent(Deno.env.get('SITE_URL') || 'http://localhost:5173')}`

    // Generate email content
    const actionText = mode === 'helped' ? 'helped you' : 'you helped them'
    const subject = `${inviter_name} wants to track time with you on Yard`
    
    const htmlContent = `
      <h2>You have been invited to Yard</h2>
      <p>Hi ${invitee_name},</p>
      <p>${inviter_name} wants to track ${hours} hour${hours !== 1 ? 's' : ''} of time where ${actionText} on Yard.</p>
      <p>Yard is a professional time tracking and networking platform where time becomes currency and expertise flows freely through your network.</p>
      <p><a href="${inviteUrl}" style="background-color: #000; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; display: inline-block;">Accept Invitation & Join Yard</a></p>
      <p>If the button doesn't work, copy and paste this link into your browser:</p>
      <p>${inviteUrl}</p>
      <p>Best regards,<br>The Yard Team</p>
    `

    const textContent = `
      Hi ${invitee_name},

      ${inviter_name} wants to track ${hours} hour${hours !== 1 ? 's' : ''} of time where ${actionText} on Yard.

      Yard is a professional time tracking and networking platform where time becomes currency and expertise flows freely through your network.

      Click this link to accept the invitation and join Yard:
      ${inviteUrl}

      Best regards,
      The Yard Team
    `

    // Send email using Supabase Auth admin API
    const { data, error } = await supabaseAdmin.auth.admin.inviteUserByEmail(invitee_email, {
      data: {
        full_name: invitee_name,
        invited_by: inviter_name,
        invitation_type: 'time_logging'
      },
      redirectTo: Deno.env.get('SITE_URL') || 'http://localhost:5173'
    })

    if (error) {
      console.error('Error sending invitation email:', error)
      throw error
    }

    console.log('Invitation email sent successfully to:', invitee_email)

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Invitation email sent successfully',
        data: data
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
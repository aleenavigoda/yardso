import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

interface SearchQuery {
  query: string
}

interface ParsedSearchParams {
  serviceType: string
  deliverableFormat: string
  timeline: string
  industry: string
  timeEstimate: string
  companyStage: string
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { query }: SearchQuery = await req.json()

    if (!query || typeof query !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Query is required and must be a string' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Parse the search query using keyword matching and context clues
    const parsedParams = parseSearchQuery(query.toLowerCase())

    return new Response(
      JSON.stringify(parsedParams),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  } catch (error) {
    console.error('Error parsing search query:', error)
    return new Response(
      JSON.stringify({ error: 'Failed to parse search query' }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})

function parseSearchQuery(query: string): ParsedSearchParams {
  const result: ParsedSearchParams = {
    serviceType: 'Design Critique',
    deliverableFormat: 'Live Consultation',
    timeline: 'Immediate',
    industry: 'Technology',
    timeEstimate: '1-2 hours',
    companyStage: 'Pre-seed'
  }

  // Service Type Detection
  if (query.includes('ux') || query.includes('ui') || query.includes('design') || query.includes('interface') || query.includes('wireframe') || query.includes('prototype')) {
    result.serviceType = 'Design Critique'
  } else if (query.includes('code') || query.includes('review') || query.includes('programming') || query.includes('bug') || query.includes('debug')) {
    result.serviceType = 'Code Review'
  } else if (query.includes('legal') || query.includes('contract') || query.includes('term sheet') || query.includes('agreement') || query.includes('lawyer')) {
    result.serviceType = 'Legal Review'
  } else if (query.includes('strategy') || query.includes('business') || query.includes('plan') || query.includes('roadmap') || query.includes('direction')) {
    result.serviceType = 'Strategy Consultation'
  } else if (query.includes('mentor') || query.includes('guidance') || query.includes('advice') || query.includes('coaching')) {
    result.serviceType = 'Mentorship'
  } else if (query.includes('financial') || query.includes('finance') || query.includes('funding') || query.includes('investment') || query.includes('valuation')) {
    result.serviceType = 'Financial Analysis'
  } else if (query.includes('technical') || query.includes('tech') || query.includes('engineering') || query.includes('architecture') || query.includes('system')) {
    result.serviceType = 'Technical Consultation'
  } else if (query.includes('marketing') || query.includes('growth') || query.includes('acquisition') || query.includes('campaign') || query.includes('brand')) {
    result.serviceType = 'Marketing Strategy'
  }

  // Deliverable Format Detection
  if (query.includes('written') || query.includes('document') || query.includes('report') || query.includes('feedback') || query.includes('notes')) {
    result.deliverableFormat = 'Written Feedback'
  } else if (query.includes('video') || query.includes('call') || query.includes('zoom') || query.includes('meeting') || query.includes('remote')) {
    result.deliverableFormat = 'Video Call'
  } else if (query.includes('workshop') || query.includes('session') || query.includes('training') || query.includes('group')) {
    result.deliverableFormat = 'Workshop Session'
  } else if (query.includes('documentation') || query.includes('guide') || query.includes('manual') || query.includes('spec')) {
    result.deliverableFormat = 'Documentation'
  } else {
    result.deliverableFormat = 'Live Consultation'
  }

  // Timeline Detection
  if (query.includes('urgent') || query.includes('asap') || query.includes('immediate') || query.includes('now') || query.includes('today')) {
    result.timeline = 'Immediate'
  } else if (query.includes('48 hours') || query.includes('2 days') || query.includes('couple days') || query.includes('soon')) {
    result.timeline = 'Within 48 hours'
  } else if (query.includes('this week') || query.includes('week') || query.includes('7 days')) {
    result.timeline = 'This week'
  } else if (query.includes('next week') || query.includes('following week')) {
    result.timeline = 'Next week'
  } else if (query.includes('flexible') || query.includes('whenever') || query.includes('no rush')) {
    result.timeline = 'Flexible'
  }

  // Industry Detection
  if (query.includes('healthcare') || query.includes('medical') || query.includes('health') || query.includes('biotech') || query.includes('pharma')) {
    result.industry = 'Healthcare'
  } else if (query.includes('finance') || query.includes('fintech') || query.includes('banking') || query.includes('investment') || query.includes('trading')) {
    result.industry = 'Finance'
  } else if (query.includes('education') || query.includes('learning') || query.includes('school') || query.includes('university') || query.includes('edtech')) {
    result.industry = 'Education'
  } else if (query.includes('entertainment') || query.includes('media') || query.includes('gaming') || query.includes('content') || query.includes('streaming')) {
    result.industry = 'Entertainment'
  } else if (query.includes('tech') || query.includes('software') || query.includes('app') || query.includes('platform') || query.includes('saas') || query.includes('startup')) {
    result.industry = 'Technology'
  }

  // Time Estimate Detection
  if (query.includes('1 hour') || query.includes('one hour') || query.includes('quick') || query.includes('brief')) {
    result.timeEstimate = '1-2 hours'
  } else if (query.includes('half day') || query.includes('morning') || query.includes('afternoon') || query.includes('4 hours')) {
    result.timeEstimate = 'Half day'
  } else if (query.includes('full day') || query.includes('8 hours') || query.includes('all day') || query.includes('intensive')) {
    result.timeEstimate = 'Full day'
  } else if (query.includes('multiple days') || query.includes('several days') || query.includes('week') || query.includes('ongoing')) {
    result.timeEstimate = 'Multiple days'
  } else if (query.includes('project') || query.includes('long term') || query.includes('extended') || query.includes('ongoing')) {
    result.timeEstimate = 'Ongoing project'
  }

  // Company Stage Detection
  if (query.includes('pre-seed') || query.includes('idea') || query.includes('early') || query.includes('starting')) {
    result.companyStage = 'Pre-seed'
  } else if (query.includes('seed') || query.includes('mvp') || query.includes('prototype') || query.includes('launch')) {
    result.companyStage = 'Seed'
  } else if (query.includes('series a') || query.includes('growth') || query.includes('scaling') || query.includes('expanding')) {
    result.companyStage = 'Series A'
  } else if (query.includes('series b') || query.includes('mature') || query.includes('established') || query.includes('scale')) {
    result.companyStage = 'Series B+'
  } else if (query.includes('public') || query.includes('ipo') || query.includes('large') || query.includes('enterprise')) {
    result.companyStage = 'Public Company'
  }

  return result
}
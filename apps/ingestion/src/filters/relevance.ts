/**
 * Relevance filter to distinguish actual ICE/CBP sighting reports
 * from general political commentary, news sharing, and opinions
 *
 * STRICT MODE: Only accepts posts with clear first-hand sighting language
 * and specific location/time details. Rejects vague mentions and commentary.
 */

// Strong indicators of first-hand sighting (high weight)
// These MUST be present for a post to be considered relevant
const FIRST_HAND_INDICATORS = [
  // First-person witness language with action verb
  /\bi (just )?(saw|see|spotted|witnessed|noticed)\s+(ice|agents?|officers?|cbp|border patrol|la migra)/i,
  /\bwe (just )?(saw|see|spotted|witnessed|noticed)\s+(ice|agents?|officers?|cbp|border patrol|la migra)/i,
  /\b(my|our) (neighbor|friend|family|coworker)\s+(saw|spotted)\s+(ice|agents?)/i,

  // Present/immediate tense with ICE mention
  /\b(ice|agents?|cbp)\b.{0,30}\b(right now|rn|currently|at this moment|as we speak)\b/i,
  /\b(right now|rn|currently)\b.{0,30}\b(ice|agents?|cbp)\b/i,
  /\b(happening|ongoing|active)\s+(right now|now|rn|here)\b/i,

  // Urgent alert with specific warning
  /\b(heads up|alert|warning|urgent)[!:]?\s*.{0,20}(ice|agents?|cbp|checkpoint|raid)/i,
  /\b(avoid|stay away from|don't go)\s+.{0,30}(ice|agents?|checkpoint)/i,

  // ICE at specific location (not just "ICE is...")
  /\bice\s+(is |are )?(at|on|near|outside|in front of)\s+\w+/i,
  /\b(ice |cbp )?(agents?|officers?)\s+(at|on|near|outside|parked at)\s+\w+/i,

  // Spanish first-hand reports - more flexible matching
  /\b(los vi|los veo|vi a|veo a)\b.{0,30}(ice|migra|agentes?|la migra)/i,
  /\b(están|andan|hay)\s+(aquí|por aquí|en)\b.{0,15}(ice|migra|agentes?)/i,
  /\b(ahorita|ahora mismo|en este momento)\b/i,
  /\balerta[!:]?\s/i,
  /\bcuidado\b.{0,20}(ice|migra|agentes?)/i,
  /\b(ice|migra|agentes?).{0,20}\bcuidado\b/i,
  /\beviten\s+(el área|la zona|ese lugar)/i,
  /\bno vayan\s+(a|por)\b.{0,30}(ice|migra|agentes?|checkpoint|retén)/i,
  /\bno vayan\s+(a|por)\b/i,

  // Indirect immediate: neighbor/friend just texted/called about ICE
  /\b(neighbor|friend|primo|vecino)\s+(just\s+)?(texted|called|messaged|told me)\b.{0,30}(ice|agents?|cbp|la migra|checkpoint)/i,

  // "happening right now/rn" strengthened
  /\b(happening|going on)\s+(right now|rn)\b.{0,30}(ice|agents?|cbp|checkpoint|raid)/i,
  /\b(ice|agents?|cbp|checkpoint|raid).{0,30}\b(happening|going on)\s+(right now|rn)\b/i,

  // Explicit sighting with location
  /\bice\s+(sighting|spotted|seen|activity)\s+(at|on|near|in)\b/i
];

// Moderate indicators of sighting (medium weight)
// These support a first-hand indicator but are not sufficient alone
const SIGHTING_INDICATORS = [
  // Action descriptions with context
  /\b(ice|agents?|they)\s+(pulled over|stopped|detained|arrested)\b/i,
  /\b(ice|agents?|they)\s+(showed up|arrived|rolled up|parked)\b/i,
  /\b(checking|asking for)\s+(ids|documents|papers|licenses)\b/i,
  /\b(knocking on doors|going door to door|door-to-door)\b/i,

  // Vehicle descriptions (with ICE context)
  /\b(ice|unmarked|suspicious)\s+(van|vans|vehicle|suv|truck)\b/i,
  /\b(white|black|dark)\s+(van|suv|truck)\b.{0,30}(ice|agents?|checkpoint)/i,

  // Specific street addresses or intersections
  /\b\d{2,5}\s+(n\.?|s\.?|e\.?|w\.?)?\s*\w+\s*(st|street|ave|avenue|rd|road|blvd|dr|drive)\b/i,
  /\b(intersection|corner)\s+(of\s+)?\w+\s+(and|&|y)\s+\w+/i,
  /\b(near|at|on)\s+\w+\s+(and|&)\s+\w+\b/i,

  // Specific locations
  /\b(at|near|outside|in front of)\s+(the\s+)?(walmart|target|home depot|costco|safeway|kroger|publix)/i,
  /\b(at|near|outside)\s+(the\s+)?\w+\s+(plaza|mall|market|store|school|church)\b/i,

  // Time specifics (recent - within hours)
  /\b(this morning|this afternoon|right now|just now)\b/i,
  /\b(\d+|few|couple)\s*(minutes?|mins?)\s*ago\b/i,
  /\b(an?\s+)?hour\s*ago\b/i,

  // Quantity with agent context
  /\b(multiple|several|\d+)\s*(ice\s+)?(agents?|officers?|vehicles?)\b/i,

  // Specific activity types
  /\b(checkpoint|roadblock)\s+(on|at|near)\b/i,
  /\b(raid|operation)\s+(at|on|in)\b/i
];

// Strong exclusion patterns (automatic reject)
const EXCLUSION_PATTERNS = [
  // Retweets and shares
  /^RT\s*@/i,
  /\bvia\s*@\w+/i,
  /\brepost(ing|ed)?\b/i,
  /^@\w+\s+/,  // Replies that start with @mention

  // News article sharing (narrowed: only "breaking:" with news-sharing context)
  /\b(breaking|new|latest):\s.{0,30}\b(report|article|story|via|according)\b/i,
  /\bread\s*(this|more|the)\b.*\b(article|story|thread|report)\b/i,
  /\bfull\s*(story|article|report)\b/i,
  /\blink in bio\b/i,
  /\b(news|report|article)\s*(here|below|attached)\b/i,

  // Clearly historical/past events
  /\b(last (week|month|year)|yesterday|days ago|weeks ago|months ago)\b/i,
  /\b(in (2019|2020|2021|2022|2023|2024|2025|2026))\b/i,
  /\bback (in|when)\b/i,
  /\b(used to|remember when)\b/i,

  // Fundraising/donation requests
  /\b(donate|donation|gofundme|fundraiser|venmo|cashapp|paypal|zelle)\b/i,
  /\b(help (us|them) raise|support (this|the) family)\b/i,

  // Job postings / official announcements
  /\b(now hiring|job opening|career|apply now|we're hiring)\b/i,
  /\b(press release|official statement|statement from)\b/i,

  // Clearly not US locations
  /\b(uk|united kingdom|london|england|canada|toronto|mexico city|europe|australia)\b/i,
  /\b(brexit|eu\s+immigration|european union)\b/i,

  // Questions asking for info (not reporting)
  /\b(has anyone|have you|did anyone|does anyone)\s+(seen?|heard?|know)\b/i,
  /\b(is there|are there)\s+.{0,20}(ice|checkpoint|activity)\b/i,
  /\b(any(one|body)?|where)\s+.{0,15}(ice|checkpoint|sighting)/i,
  /\bwhat('s| is| are)\s+(ice|they)\s+doing\b/i,
  /\bwhere\s+(is|are)\s+(ice|they)\b/i,
  // Removed: /\?$/ — was blocking valid reports like "ICE at Main St checkpoint?"

  // Hypotheticals and conditionals
  /\bif (ice|they|agents)\s+(come|show up|raid|arrive)\b/i,
  /\bwhat (to do|if|happens)\s+.{0,15}(ice|raid|checkpoint)\b/i,
  /\b(know your rights|your rights|legal rights)\b/i,

  // General advice/guides
  /\b(how to|what to do|tips for|guide to)\b/i,
  /\b(if you see|when you see|in case of)\b/i,

  // Memes, jokes, sarcasm
  /\b(lmao|lol|rofl|dead|crying|bruh)\b/i,
  /\b(imagine|literally me|no one:|nobody:)\b/i,

  // Promotional content
  /\b(check out|follow|subscribe|like and share)\b/i,
  /\b(new (video|podcast|episode|post)|watch my)\b/i,

  // Legal/rights information
  /\b(miranda rights|legal (advice|help|aid)|attorney|lawyer)\b/i,
  /\b(sanctuary (city|state)|ice (policy|policies))\b/i,

  // Statistics and data
  /\b(\d+%|\d+,\d+|\d+ (million|thousand|hundred))\b/i,
  /\b(statistics|data shows|according to data)\b/i,

  // Viral/trending content patterns
  /\b(going viral|trending|blow up|famous)\b/i,
  /\b(ratio|ratioed|main character)\b/i,

  // Bot-like patterns
  /\b(f4f|follow4follow|followback|follow back)\b/i,
  /\b(automated|bot|scheduled)\b/i,

  // Spam link shorteners
  /\b(bit\.ly|tinyurl|t\.co|goo\.gl|ow\.ly)\b/i
];

// Commentary indicators (reduce score significantly)
const COMMENTARY_INDICATORS = [
  // Political figures and parties
  /\b(trump('s)?|biden('s)?|obama('s)?|harris|desantis|pence|vance)\b/i,
  /\b(administration|white house|dhs|homeland security)\b/i,
  /\b(republican|democrat|gop|liberal|conservative|maga)\b/i,
  /\b(congress|senate|house|legislation|bill|law|policy|policies)\b/i,
  /\b(president|governor|senator|mayor|politician)\b/i,

  // Election-related keywords
  /\b(election|vote|voting|ballot|campaign|2024|2028)\b/i,
  /\b(poll|polls|polling|primary|caucus)\b/i,

  // Advocacy organizations
  /\b(aclu|united we dream|raices|immigrant rights)\b/i,
  /\b(advocacy|activist|activists|organizing|organizers)\b/i,

  // Opinion language
  /\b(i think|i believe|i feel|imo|imho|in my opinion)\b/i,
  /\b(should|must|need to|ought to|has to)\s+(be|do|stop|end|change)\b/i,
  /\b(wrong|evil|terrible|horrible|disgusting|shameful|outrageous|inhumane)\b/i,
  /\b(abolish|defund|reform|disband|end)\s*ice\b/i,

  // Emotional reactions (not reports)
  /\b(i('m| am)|we('re| are))\s*(so )?(angry|sad|scared|furious|disgusted|heartbroken|sick)\b/i,
  /\b(this is|that's|it's)\s*(so )?(sad|wrong|evil|heartbreaking|infuriating|terrible)\b/i,
  /\b(can't believe|unbelievable|unacceptable|outraged)\b/i,
  /\b(heartbroken|devastated|horrified|sickened)\b/i,

  // Call to action (not reporting)
  /\b(call your|contact your|write to|email your)\s*(rep|representative|senator|congressman)\b/i,
  /\b(sign (this|the) petition|take action|join (us|the)|stand (up|with))\b/i,
  /\b(spread the word|share this|please share|retweet|boost this)\b/i,
  /\b(we (need|must)|let's|let us)\s+(fight|stop|resist|stand)\b/i,

  // General statements about ICE (not sightings)
  /\b(ice agents are|all ice|every ice|these agents|ice is)\s+(evil|wrong|terrible|criminal)/i,
  /\bice\s+(is|are)\s+(destroying|ruining|terrorizing|targeting)/i,
  /\b(this country|our country|america|in the us)\s+(is|has|needs)\b/i,
  /\b(human rights|civil rights|constitution|democracy|freedom)\b/i,
  /\b(fascism|fascist|nazi|gestapo|authoritarian|tyranny|dictatorship)\b/i,

  // News/media language
  /\b(according to|sources say|reported that|reports indicate|reportedly)\b/i,
  /\b(breaking news|developing story|update:|just in:)\b/i,
  /\bnews\s*(article|story|report|outlet|source)\b/i,
  /\b(journalist|reporter|media|coverage)\b/i,

  // Rhetorical questions
  /\bwhy (do|does|is|are|won't|can't|don't)\b.{5,}\?$/i,
  /\bhow (can|could|is|are|long|many)\b.{5,}\?$/i,
  /\bwhen will\b.{5,}\?$/i,
  /\bwhat (is|are|happened|about|kind)\b.{5,}\?$/i,

  // Hashtag activism
  /#abolish\w*/i,
  /#(resist|resistance|notmypresident|fuckice)\b/i,
  /#\w*(rights|justice|solidarity|noice)\b/i,
  /#(immigration|immigrant|undocumented)\b/i,

  // Vague mentions without details - auto exclude
  /\bice\s+(is|are)\s+(out|everywhere|around|active)\b/i,
  /\b(stay safe|be safe|be careful)\b(?!.{0,20}(at|on|near|avoid|around|in\s+\w{3,}))/i,
  /\bice\s+(activity|presence|operations)\s+(in|around|nearby)\b/i,
  /\bice\s+activity\b(?!.{0,10}(at|on)\s+\w+)/i,
  /\b(in the area|around here|nearby|in this area)\b(?!.{0,20}(at|on|near)\s+\w+)/i,

  // Second-hand/rumor language
  /\b(i heard|someone said|apparently|supposedly|rumor|word is)\b/i,
  /\b(people are saying|they're saying|folks say)\b/i,
  /\b(not sure if|don't know if|might be|could be)\b/i
];

// Weak context - these words alone are NOT sufficient
// Post must have first-hand indicators to be relevant
const WEAK_CONTEXT = [
  /\bice\b/i,           // Just "ICE" alone
  /\braid\b/i,          // Just "raid"
  /\bcheckpoint\b/i,    // Just "checkpoint"
  /\bdeportation\b/i,   // Just "deportation"
  /\bimmigration\b/i,   // Just "immigration"
  /\bcbp\b/i,           // Just "CBP"
  /\bborder patrol\b/i, // Just "border patrol"
  /\bla migra\b/i,      // Just "la migra"
  /\bagents?\b/i,       // Just "agents"
  /\benforcement\b/i    // Just "enforcement"
];

export interface RelevanceResult {
  isRelevant: boolean;
  score: number;
  confidence: 'high' | 'medium' | 'low';
  sightingIndicators: string[];
  commentaryIndicators: string[];
  reason: string;
}

/**
 * Check if a post is likely an actual sighting report vs general commentary
 */
export function checkRelevance(text: string): RelevanceResult {
  // First check exclusion patterns - automatic reject
  for (const pattern of EXCLUSION_PATTERNS) {
    if (pattern.test(text)) {
      return {
        isRelevant: false,
        score: -10,
        confidence: 'high',
        sightingIndicators: [],
        commentaryIndicators: [],
        reason: 'Matches exclusion pattern (news/repost/historical)'
      };
    }
  }

  const firstHandMatches: string[] = [];
  const sightingMatches: string[] = [];
  const commentaryMatches: string[] = [];

  // Check for first-hand indicators (high weight)
  for (const pattern of FIRST_HAND_INDICATORS) {
    const match = text.match(pattern);
    if (match) {
      firstHandMatches.push(match[0]);
    }
  }

  // Check for sighting indicators (medium weight)
  for (const pattern of SIGHTING_INDICATORS) {
    const match = text.match(pattern);
    if (match) {
      sightingMatches.push(match[0]);
    }
  }

  // Check for commentary indicators
  for (const pattern of COMMENTARY_INDICATORS) {
    const match = text.match(pattern);
    if (match) {
      commentaryMatches.push(match[0]);
    }
  }

  // Calculate score with weighted system
  // First-hand indicators are essential - high weight
  const firstHandScore = firstHandMatches.length * 5;
  // Sighting indicators are supporting - lower weight
  const sightingScore = sightingMatches.length * 2;
  // Commentary is a strong penalty
  const commentaryScore = commentaryMatches.length * 3;

  const totalPositive = firstHandScore + sightingScore;
  const score = totalPositive - commentaryScore;

  // STRICT CRITERIA:
  // Must have at least ONE first-hand indicator
  // Sighting indicators alone are NOT sufficient
  const hasFirstHand = firstHandMatches.length >= 1;
  const hasSighting = sightingMatches.length >= 1;
  const hasCommentary = commentaryMatches.length > 0;

  // Minimum requirements:
  // 1. At least one first-hand indicator OR
  // 2. Multiple sighting indicators (3+) with NO commentary
  const hasStrongSignal = hasFirstHand ||
    (sightingMatches.length >= 3 && !hasCommentary);

  // Must have strong signal AND positive score >= 3
  const isRelevant = hasStrongSignal && score >= 3;

  // Determine confidence level (stricter thresholds)
  let confidence: 'high' | 'medium' | 'low';
  if (firstHandMatches.length >= 2 && sightingMatches.length >= 2 && score >= 10) {
    confidence = 'high';
  } else if (hasFirstHand && sightingMatches.length >= 1 && score >= 5) {
    confidence = 'medium';
  } else {
    confidence = 'low';
  }

  // Generate reason
  let reason: string;
  if (!hasFirstHand && !hasSighting) {
    reason = 'No sighting indicators found - must include first-hand language';
  } else if (!hasFirstHand && hasSighting) {
    reason = 'Missing first-hand language (e.g., "I saw", "spotted", "right now")';
  } else if (hasCommentary && score < 3) {
    reason = 'Commentary/opinion outweighs sighting indicators';
  } else if (!hasStrongSignal) {
    reason = 'Weak signal - needs clear first-hand sighting language';
  } else if (score < 3) {
    reason = 'Score too low - insufficient sighting details';
  } else {
    reason = 'First-hand sighting report with location/time details';
  }

  return {
    isRelevant,
    score,
    confidence,
    sightingIndicators: [...firstHandMatches, ...sightingMatches],
    commentaryIndicators: commentaryMatches,
    reason
  };
}

/**
 * Quick check - returns true if post should be processed
 */
export function isRelevantPost(text: string): boolean {
  return checkRelevance(text).isRelevant;
}

// ============================================
// NEWS ARTICLE RELEVANCE FILTER
// ============================================

import { classifySource, type SourceTier } from './news-sources.js';

// Required: ICE/CBP mention in news articles
const NEWS_REQUIRED = [
  /\b(ice|i\.c\.e\.)\b/i,
  /\bcbp\b/i,
  /\bborder patrol\b/i,
  /\bimmigration\s+(and\s+)?customs\s+enforcement\b/i,
  /\bcustoms\s+and\s+border\s+(protection|patrol)\b/i,
];

// Required: Action keyword in news articles
const NEWS_ACTIONS = [
  /\braid(s|ed|ing)?\b/i,
  /\barrest(s|ed|ing)?\b/i,
  /\bdetain(s|ed|ing|ee|ees)?\b/i,
  /\bcheckpoint(s)?\b/i,
  /\boperation(s)?\b/i,
  /\benforcemen(t|ts)?\b/i,
  /\bdeport(s|ed|ing|ation|ations)?\b/i,
  /\bapprehend(s|ed|ing|sion|sions)?\b/i,
];

// Reject: Opinion/editorial pieces
const NEWS_EXCLUSIONS = [
  /\bopinion\b/i,
  /\beditorial\b/i,
  /\bpolicy debate\b/i,
  /\bop-ed\b/i,
  /\banalysis:\s/i,
  /\bcommentary\b/i,
  /\bletter to the editor\b/i,
  /\bwhat (trump|biden|the administration) (should|must|needs to)\b/i,
];

export interface NewsRelevanceResult {
  isRelevant: boolean;
  hasAgency: boolean;
  hasAction: boolean;
  sourceTier: SourceTier;
  reason: string;
}

/**
 * Check if a news article is relevant.
 * Trusted sources: agency mention alone suffices (action keyword not required).
 * Blocked sources: skipped entirely.
 */
export function checkNewsRelevance(title: string, description: string = "", sourceName: string = ""): NewsRelevanceResult {
  const text = `${title} ${description}`.toLowerCase();
  const tier = sourceName ? classifySource(sourceName) : 'unknown' as SourceTier;

  // Blocked sources: skip entirely
  if (tier === 'blocked') {
    return {
      isRelevant: false,
      hasAgency: false,
      hasAction: false,
      sourceTier: tier,
      reason: `Blocked source: ${sourceName}`,
    };
  }

  // Check exclusions first
  for (const pattern of NEWS_EXCLUSIONS) {
    if (pattern.test(text)) {
      return {
        isRelevant: false,
        hasAgency: false,
        hasAction: false,
        sourceTier: tier,
        reason: "Opinion/editorial piece excluded",
      };
    }
  }

  // Check for ICE/CBP mention
  const hasAgency = NEWS_REQUIRED.some((pattern) => pattern.test(text));

  // Check for action keyword
  const hasAction = NEWS_ACTIONS.some((pattern) => pattern.test(text));

  // Trusted sources: agency mention alone is sufficient
  const isRelevant = tier === 'trusted' ? hasAgency : (hasAgency && hasAction);

  let reason: string;
  if (!hasAgency) {
    reason = "Missing ICE/CBP agency mention";
  } else if (!hasAction && tier !== 'trusted') {
    reason = "Missing action keyword (raid, arrest, detention, etc.)";
  } else {
    reason = tier === 'trusted'
      ? `Trusted source (${sourceName}) reporting on ICE/CBP`
      : "News article about ICE/CBP enforcement activity";
  }

  return {
    isRelevant,
    hasAgency,
    hasAction,
    sourceTier: tier,
    reason,
  };
}

/**
 * Quick check for news articles
 */
export function isRelevantNews(title: string, description: string = "", sourceName: string = ""): boolean {
  return checkNewsRelevance(title, description, sourceName).isRelevant;
}

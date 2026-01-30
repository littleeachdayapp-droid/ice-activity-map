import { describe, it, expect } from 'vitest';
import { checkRelevance, isRelevantPost, checkNewsRelevance } from './relevance';

describe('Relevance Filter', () => {
  describe('checkRelevance', () => {
    it('should identify first-hand sighting reports', () => {
      const sightingPosts = [
        'I just saw ICE agents at the intersection of Main and 5th street',
        'Heads up! ICE is at the corner of Broadway right now',
        'ALERT: ICE agents parked outside the grocery store on Oak Ave',
        'We spotted multiple agents going door to door this morning',
        'Just saw unmarked van with ICE near the school, be careful'
      ];

      for (const post of sightingPosts) {
        const result = checkRelevance(post);
        expect(result.isRelevant, `Expected "${post.slice(0, 50)}..." to be relevant`).toBe(true);
        expect(result.sightingIndicators.length).toBeGreaterThan(0);
      }
    });

    it('should filter out political commentary', () => {
      const commentaryPosts = [
        'Trump administration ICE policies are destroying families',
        'Will ANY Republican lawmaker denounce this? ICE agents are out of control',
        'ICE should be abolished. This is fascism.',
        'Biden needs to reform ICE immediately, this is a human rights crisis',
        'I think ICE is wrong and evil for what they do to people',
        'Why do Republicans support ICE raids? This country is broken'
      ];

      for (const post of commentaryPosts) {
        const result = checkRelevance(post);
        expect(result.isRelevant, `Expected "${post.slice(0, 50)}..." to NOT be relevant`).toBe(false);
      }
    });

    it('should filter out news sharing and retweets', () => {
      const newsPosts = [
        'RT @NewsOutlet: ICE conducted raids in multiple cities',
        'Read this article about how ICE is targeting communities',
        'According to reports, ICE arrested 50 people yesterday',
        'Breaking: ICE operations reported across the state',
        'Click here to read about ICE operations in Texas via @reporter'
      ];

      for (const post of newsPosts) {
        const result = checkRelevance(post);
        expect(result.isRelevant, `Expected "${post.slice(0, 50)}..." to NOT be relevant`).toBe(false);
      }
    });

    it('should filter out historical references', () => {
      const historicalPosts = [
        'ICE raided this neighborhood last week',
        'Remember when ICE came here in 2023?',
        'ICE was here yesterday but they left',
        'Back when ICE did raids in this area...',
        'Last month ICE arrested several people here'
      ];

      for (const post of historicalPosts) {
        const result = checkRelevance(post);
        expect(result.isRelevant, `Expected "${post.slice(0, 50)}..." to NOT be relevant`).toBe(false);
      }
    });

    it('should filter out fundraising and donation requests', () => {
      const fundraisingPosts = [
        'Please donate to help families affected by ICE raids',
        'GoFundMe for family detained by ICE - link in bio',
        'Support this family via Venmo after ICE took their father'
      ];

      for (const post of fundraisingPosts) {
        const result = checkRelevance(post);
        expect(result.isRelevant, `Expected "${post.slice(0, 50)}..." to NOT be relevant`).toBe(false);
      }
    });

    it('should recognize Spanish language sighting reports', () => {
      const spanishSightings = [
        'Los vi en la calle principal ahorita, cuidado',
        'Alerta! ICE está aquí en el centro ahora mismo',
        'Agentes andan por el mercado, eviten el área'
      ];

      for (const post of spanishSightings) {
        const result = checkRelevance(post);
        expect(result.isRelevant, `Expected "${post.slice(0, 50)}..." to be relevant`).toBe(true);
      }
    });

    it('should return appropriate scores and confidence', () => {
      // High confidence sighting
      const sighting = checkRelevance('I just saw ICE agents at the corner of 5th and Main, they arrived 5 minutes ago, avoid the area');
      expect(sighting.score).toBeGreaterThan(0);
      expect(sighting.isRelevant).toBe(true);
      expect(['high', 'medium']).toContain(sighting.confidence);

      // Commentary should have low/negative score
      const commentary = checkRelevance('Trump administration ICE policy is wrong and terrible for democracy');
      expect(commentary.score).toBeLessThanOrEqual(0);
      expect(commentary.isRelevant).toBe(false);
    });

    it('should handle posts with no indicators', () => {
      const result = checkRelevance('Hello world');
      expect(result.isRelevant).toBe(false);
      expect(result.sightingIndicators).toHaveLength(0);
      expect(result.reason).toBe('No sighting indicators found - must include first-hand language');
    });

    it('should handle mixed content - commentary overwhelms weak sighting', () => {
      const mixed = 'I saw something about ICE but Trump should be blamed for this terrible policy that destroys democracy';
      const result = checkRelevance(mixed);
      expect(result.commentaryIndicators.length).toBeGreaterThan(0);
      // Commentary should outweigh the weak "saw" indicator
      expect(result.isRelevant).toBe(false);
    });

    it('should filter out calls to action', () => {
      const ctaPosts = [
        'Call your representative about ICE raids! Take action now!',
        'Sign this petition to stop ICE in our community',
        'Please share this - spread the word about ICE activity'
      ];

      for (const post of ctaPosts) {
        const result = checkRelevance(post);
        expect(result.isRelevant, `Expected "${post.slice(0, 50)}..." to NOT be relevant`).toBe(false);
      }
    });

    it('should filter out emotional reactions without sighting info', () => {
      const emotionalPosts = [
        "I'm so angry about ICE raids happening in our city",
        "This is heartbreaking - ICE is destroying families",
        "Can't believe ICE is doing this. WTF is wrong with this country"
      ];

      for (const post of emotionalPosts) {
        const result = checkRelevance(post);
        expect(result.isRelevant, `Expected "${post.slice(0, 50)}..." to NOT be relevant`).toBe(false);
      }
    });

    it('should filter out vague mentions without first-hand language', () => {
      const vaguePosts = [
        'ICE is out there today',
        'ICE activity in the area',
        'Heard there might be ICE around',
        'ICE is everywhere',
        'Stay safe from ICE today',
        'Be careful ICE is active',
        'ICE operations happening',
        'Checkpoint somewhere in the city'
      ];

      for (const post of vaguePosts) {
        const result = checkRelevance(post);
        expect(result.isRelevant, `Expected "${post}" to NOT be relevant`).toBe(false);
      }
    });

    it('should filter out questions asking about ICE activity', () => {
      const questionPosts = [
        'Has anyone seen ICE today?',
        'Is there a checkpoint near downtown?',
        'Did anyone see ICE on Main Street?',
        'Where is ICE active right now?',
        'Any ICE sightings in LA today?',
        'Does anyone know if ICE is around?'
      ];

      for (const post of questionPosts) {
        const result = checkRelevance(post);
        expect(result.isRelevant, `Expected "${post}" to NOT be relevant`).toBe(false);
      }
    });

    it('should filter out second-hand and rumor reports', () => {
      const secondHandPosts = [
        'I heard ICE was on Main Street earlier',
        'Someone said they saw ICE downtown',
        'Apparently ICE is in the area',
        'People are saying ICE is around',
        'Word is there\'s a checkpoint somewhere',
        'Supposedly ICE arrested someone today'
      ];

      for (const post of secondHandPosts) {
        const result = checkRelevance(post);
        expect(result.isRelevant, `Expected "${post}" to NOT be relevant`).toBe(false);
      }
    });

    it('should filter out hypothetical and advice posts', () => {
      const hypotheticalPosts = [
        'If ICE shows up, know your rights',
        'What to do when ICE comes to your door',
        'How to handle an ICE encounter',
        'Tips for avoiding ICE checkpoints',
        'In case of an ICE raid, stay calm'
      ];

      for (const post of hypotheticalPosts) {
        const result = checkRelevance(post);
        expect(result.isRelevant, `Expected "${post}" to NOT be relevant`).toBe(false);
      }
    });

    it('should require specific details for sighting reports', () => {
      // These have first-hand language but are too vague
      const vagueFirstHand = [
        'I saw ICE',  // No location
        'Just spotted agents',  // No ICE mention
        'ICE is here'  // No specific location
      ];

      for (const post of vagueFirstHand) {
        const result = checkRelevance(post);
        // May or may not pass depending on threshold - checking score is lower
        expect(result.score).toBeLessThan(10);
      }

      // These should definitely pass - specific location + first-hand + time
      const specificReports = [
        'I just saw ICE agents at the corner of 5th and Main, 3 unmarked vans',
        'Heads up! ICE checkpoint on Highway 101 near exit 25, avoid the area',
        'ALERT: Multiple ICE agents outside the Walmart on Oak Street right now'
      ];

      for (const post of specificReports) {
        const result = checkRelevance(post);
        expect(result.isRelevant, `Expected "${post}" to be relevant`).toBe(true);
        expect(result.score).toBeGreaterThan(5);
      }
    });

    it('should recognize "no vayan" Spanish warnings', () => {
      const posts = [
        'No vayan por la calle 5, hay agentes de ICE parked outside',
        'No vayan a downtown, la migra anda por ahí, cuidado',
      ];
      for (const post of posts) {
        const result = checkRelevance(post);
        expect(result.isRelevant, `Expected "${post.slice(0, 50)}..." to be relevant`).toBe(true);
      }
    });

    it('should recognize indirect immediate reports (neighbor/friend texted)', () => {
      const posts = [
        'My neighbor just texted me about ICE agents on our block, multiple vehicles',
        'Friend just called - ICE checkpoint near the school on Oak Ave right now',
      ];
      for (const post of posts) {
        const result = checkRelevance(post);
        expect(result.isRelevant, `Expected "${post.slice(0, 50)}..." to be relevant`).toBe(true);
      }
    });

    it('should not reject posts ending with question marks that have strong sighting signals', () => {
      const result = checkRelevance('ICE at Main St checkpoint near Walmart right now?');
      // Should not be auto-rejected; the question mark exclusion was removed
      expect(result.score).toBeGreaterThan(0);
    });

    it('should allow "stay safe" when followed by location details', () => {
      const post = 'Stay safe around downtown, ICE agents spotted at 5th and Main right now';
      const result = checkRelevance(post);
      expect(result.sightingIndicators.length).toBeGreaterThan(0);
    });

    it('should not reject breaking alerts from community members without news-sharing context', () => {
      const post = 'Breaking: ICE agents spotted at the corner of 5th and Main right now, avoid the area';
      const result = checkRelevance(post);
      // "breaking:" without "report/article/story/via/according" should not be auto-excluded
      expect(result.score).toBeGreaterThan(0);
    });
  });

  describe('checkNewsRelevance', () => {
    it('should accept trusted sources with agency mention only (no action keyword needed)', () => {
      const result = checkNewsRelevance('ICE presence reported in downtown area', '', 'Associated Press');
      expect(result.isRelevant).toBe(true);
      expect(result.sourceTier).toBe('trusted');
    });

    it('should reject blocked sources entirely', () => {
      const result = checkNewsRelevance('ICE raids across the country', '', 'Infowars');
      expect(result.isRelevant).toBe(false);
      expect(result.sourceTier).toBe('blocked');
    });

    it('should require action keyword for unknown sources', () => {
      const noAction = checkNewsRelevance('ICE presence in the community', '', 'Random Blog');
      expect(noAction.isRelevant).toBe(false);

      const withAction = checkNewsRelevance('ICE arrests 10 in downtown raid', '', 'Random Blog');
      expect(withAction.isRelevant).toBe(true);
    });
  });

  describe('isRelevantPost', () => {
    it('should return boolean', () => {
      expect(typeof isRelevantPost('test')).toBe('boolean');
    });

    it('should match checkRelevance result', () => {
      const testPosts = [
        'I just saw ICE on Main Street right now, be careful',
        'Republicans are fascists for supporting ICE',
        'Random text with no keywords'
      ];

      for (const post of testPosts) {
        expect(isRelevantPost(post)).toBe(checkRelevance(post).isRelevant);
      }
    });
  });
});

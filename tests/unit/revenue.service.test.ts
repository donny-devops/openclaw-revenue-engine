import { classifyPaidRequest, getRevenueSummary, listRevenueLanes, listRevenueServices } from '../../src/revenue/serviceCatalog';

describe('revenue service catalog', () => {
  it('loads editable Moltgate offer lane defaults', () => {
    const lanes = listRevenueLanes();
    expect(lanes.map((lane) => lane.slug)).toEqual(
      expect.arrayContaining(['small-request', 'detailed-request', 'real-offer']),
    );
    expect(lanes.find((lane) => lane.slug === 'small-request')).toMatchObject({
      price: 19,
      human_review_required: true,
    });
    expect(lanes.find((lane) => lane.slug === 'detailed-request')).toMatchObject({ price: 29 });
    expect(lanes.find((lane) => lane.slug === 'real-offer')).toMatchObject({ price: 49 });
  });

  it('loads service catalog defaults', () => {
    const services = listRevenueServices();
    expect(services.map((service) => service.slug)).toEqual(
      expect.arrayContaining(['repo-triage', 'actions-debug', 'devsecops-hardening', 'openclaw-setup', 'ai-roadmap']),
    );
  });

  it('summarizes enabled revenue configuration', () => {
    const summary = getRevenueSummary();
    expect(summary).toMatchObject({
      currency: 'USD',
      enabled_lanes: 3,
      enabled_services: 5,
      default_lane: 'detailed-request',
      default_service: 'repo-triage',
    });
    expect(summary.min_price).toBe(19);
    expect(summary.max_price).toBe(49);
  });

  it('classifies CI workflow requests into the actions debug service', () => {
    const classification = classifyPaidRequest({
      title: 'GitHub Actions CI workflow failure',
      body: 'My workflow YAML fails during CodeQL and Trivy scanning. Please debug the action logs.',
    });

    expect(classification.service.slug).toBe('actions-debug');
    expect(classification.lane.slug).toBe('real-offer');
    expect(classification.estimated_revenue).toBe(49);
    expect(classification.labels).toEqual(
      expect.arrayContaining(['moltgate', 'paid-request', 'lane:real-offer', 'service:actions-debug']),
    );
    expect(classification.deliverable_template).toContain('GitHub Actions Debug Sprint');
  });

  it('does not route ordinary words containing ai or ci to automation/debug services', () => {
    const classification = classifyPaidRequest({
      title: 'Pricing decision details',
      body: 'Please maintain a clean repository summary and review the portfolio README.',
    });

    expect(classification.service.slug).toBe('repo-triage');
    expect(classification.lane.slug).toBe('detailed-request');
  });

  it('honors explicit lane and service overrides', () => {
    const classification = classifyPaidRequest({
      lane: 'real-offer',
      service: 'openclaw-setup',
      body: 'Set up my Moltgate paid lanes and OpenClaw polling workflow.',
    });

    expect(classification.service.slug).toBe('openclaw-setup');
    expect(classification.lane.slug).toBe('real-offer');
    expect(classification.estimated_revenue).toBe(49);
  });

  it('rejects unknown lane overrides', () => {
    expect(() => classifyPaidRequest({
      lane: 'does-not-exist',
      service: 'repo-triage',
      body: 'Please check my repository setup.',
    })).toThrow('Unknown or disabled lane: does-not-exist');
  });

  it('rejects unknown service overrides', () => {
    expect(() => classifyPaidRequest({
      lane: 'small-request',
      service: 'does-not-exist',
      body: 'Please check my repository setup.',
    })).toThrow('Unknown or disabled service: does-not-exist');
  });

  it('enforces selected lane input limits', () => {
    expect(() => classifyPaidRequest({
      lane: 'small-request',
      service: 'repo-triage',
      body: 'x'.repeat(3100),
    })).toThrow('Paid request exceeds small-request lane max_input_chars limit');
  });

  it('rejects empty paid request bodies', () => {
    expect(() => classifyPaidRequest({ body: '   ' })).toThrow('Paid request body is required');
  });
});

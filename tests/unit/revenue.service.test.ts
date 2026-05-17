import { classifyPaidRequest, getRevenueSummary, listRevenueLanes, listRevenueServices } from '../../src/revenue/serviceCatalog';

describe('revenue service catalog', () => {
  it('loads editable lane pricing defaults', () => {
    const lanes = listRevenueLanes();
    expect(lanes.map((lane) => lane.slug)).toEqual(expect.arrayContaining(['micro', 'standard', 'priority', 'ultra']));
    expect(lanes.find((lane) => lane.slug === 'standard')).toMatchObject({
      price: 25,
      currency: undefined,
      human_review_required: true,
    });
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
      enabled_lanes: 4,
      enabled_services: 5,
      default_lane: 'standard',
      default_service: 'repo-triage',
    });
    expect(summary.min_price).toBe(5);
    expect(summary.max_price).toBe(199);
  });

  it('classifies CI workflow requests into the actions debug service', () => {
    const classification = classifyPaidRequest({
      title: 'GitHub Actions failure',
      body: 'My CI workflow YAML fails during CodeQL and Trivy scanning.',
    });

    expect(classification.service.slug).toBe('actions-debug');
    expect(classification.lane.slug).toBe('priority');
    expect(classification.estimated_revenue).toBe(75);
    expect(classification.labels).toEqual(expect.arrayContaining(['moltgate', 'paid-request', 'lane:priority', 'service:actions-debug']));
    expect(classification.deliverable_template).toContain('GitHub Actions Debug Sprint');
  });

  it('honors explicit lane and service overrides', () => {
    const classification = classifyPaidRequest({
      lane: 'ultra',
      service: 'openclaw-setup',
      body: 'Set up my Moltgate paid lanes and OpenClaw polling workflow.',
    });

    expect(classification.service.slug).toBe('openclaw-setup');
    expect(classification.lane.slug).toBe('ultra');
    expect(classification.estimated_revenue).toBe(199);
  });

  it('rejects empty paid request bodies', () => {
    expect(() => classifyPaidRequest({ body: '   ' })).toThrow('Paid request body is required');
  });
});

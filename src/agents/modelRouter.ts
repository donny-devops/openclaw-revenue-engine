import { ModelProfile, ModelRoutingPolicy } from './types';

export interface SelectedModelProfile {
  profile_id: string;
  profile: ModelProfile;
  matched_rule?: string;
}

export function selectModelProfile(
  objective: string,
  policy: ModelRoutingPolicy,
  fallbackProfile?: string,
): SelectedModelProfile {
  const normalized = objective.toLowerCase();

  for (const rule of policy.routing_rules) {
    const pattern = new RegExp(rule.match, 'i');
    if (pattern.test(normalized)) {
      const profile = policy.profiles[rule.profile];
      if (!profile) {
        throw new Error(`Model routing rule references missing profile: ${rule.profile}`);
      }
      return { profile_id: rule.profile, profile, matched_rule: rule.match };
    }
  }

  const profileId = fallbackProfile ?? policy.default_profile;
  const profile = policy.profiles[profileId];
  if (!profile) {
    throw new Error(`Missing model profile: ${profileId}`);
  }

  return { profile_id: profileId, profile };
}

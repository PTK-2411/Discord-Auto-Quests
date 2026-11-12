/**
 * Test Fixtures for Discord-Auto-Quests E2E Test Suite
 * Authoritative mock data representing Discord v10 REST API responses,
 * user profiles, quests, task configs, and error responses.
 */

const mockUser = {
  id: '109876543210987654',
  username: 'DiscordTester',
  global_name: 'Discord Auto Quests QA',
  avatar: 'a_76e5d8a9f0b1c2d3e4f5',
  discriminator: '0'
};

const mockUserNoAvatar = {
  id: '109876543210987655',
  username: 'AvatarlessUser',
  global_name: null,
  avatar: null,
  discriminator: '1234'
};

const mockInitialBalance = {
  balance: 240
};

const mockFinalBalance = {
  balance: 320
};

const makeExpiresAt = (offsetMs) => new Date(Date.now() + offsetMs).toISOString();

const mockVideoQuest = {
  id: 'quest_vid_001',
  config: {
    messages: {
      quest_name: 'Watch The Finals Trailer'
    },
    task_config_v2: {
      tasks: {
        WATCH_VIDEO: {
          target: 15
        }
      }
    },
    rewards_config: {
      rewards: [
        { orb_quantity: 50 }
      ]
    },
    expires_at: makeExpiresAt(86400000) // +24 hours
  },
  user_status: null
};

const mockMobileVideoQuest = {
  id: 'quest_vid_mob_002',
  config: {
    messages: {
      quest_name: 'Watch Mobile Highlights'
    },
    task_config_v2: {
      tasks: {
        WATCH_VIDEO_ON_MOBILE: {
          target: 10
        }
      }
    },
    rewards_config: {
      rewards: [
        { orb_quantity: 30 }
      ]
    },
    expires_at: makeExpiresAt(86400000)
  },
  user_status: null
};

const mockDesktopPlayQuest = {
  id: 'quest_play_003',
  config: {
    messages: {
      quest_name: 'Play Genshin Impact Desktop'
    },
    application: {
      id: 'app_genshin_888'
    },
    task_config_v2: {
      tasks: {
        PLAY_ON_DESKTOP: {
          target: 120,
          applications: [
            { id: 'app_genshin_888' }
          ]
        }
      }
    },
    rewards_config: {
      rewards: [
        {
          messages: {
            name: 'Special Wind Glider'
          }
        }
      ]
    },
    expires_at: makeExpiresAt(86400000)
  },
  user_status: null
};

// Already completed quest awaiting claim
const mockCompletedUnclaimedQuest = {
  id: 'quest_unclaimed_004',
  config: {
    messages: {
      quest_name: 'Completed League Quest'
    },
    task_config_v2: {
      tasks: {
        WATCH_VIDEO: { target: 15 }
      }
    },
    rewards_config: {
      rewards: [
        { orb_quantity: 25 }
      ]
    },
    expires_at: makeExpiresAt(86400000)
  },
  user_status: {
    enrolled_at: new Date(Date.now() - 3600000).toISOString(),
    completed_at: new Date(Date.now() - 1800000).toISOString(),
    claimed_at: null
  }
};

// Defective quest that MUST be filtered out
const mockDefectiveQuest = {
  id: '1412491570820812933',
  config: {
    messages: {
      quest_name: 'Defective Corrupted Quest'
    },
    task_config_v2: {
      tasks: {
        WATCH_VIDEO: { target: 30 }
      }
    },
    rewards_config: {
      rewards: [
        { orb_quantity: 100 }
      ]
    },
    expires_at: makeExpiresAt(86400000)
  },
  user_status: null
};

// Expired quest that MUST be filtered out
const mockExpiredQuest = {
  id: 'quest_expired_005',
  config: {
    messages: {
      quest_name: 'Expired Winter Quest'
    },
    task_config_v2: {
      tasks: {
        WATCH_VIDEO: { target: 30 }
      }
    },
    rewards_config: {
      rewards: [
        { orb_quantity: 10 }
      ]
    },
    expires_at: makeExpiresAt(-86400000) // -24 hours (in the past)
  },
  user_status: null
};

// Unsupported task type
const mockUnsupportedTaskQuest = {
  id: 'quest_unsupported_006',
  config: {
    messages: {
      quest_name: 'Play on VR Headset'
    },
    task_config_v2: {
      tasks: {
        PLAY_ON_VR_HEADSET: { target: 60 }
      }
    },
    rewards_config: {
      rewards: [
        { orb_quantity: 15 }
      ]
    },
    expires_at: makeExpiresAt(86400000)
  },
  user_status: null
};

module.exports = {
  mockUser,
  mockUserNoAvatar,
  mockInitialBalance,
  mockFinalBalance,
  mockVideoQuest,
  mockMobileVideoQuest,
  mockDesktopPlayQuest,
  mockCompletedUnclaimedQuest,
  mockDefectiveQuest,
  mockExpiredQuest,
  mockUnsupportedTaskQuest,
  makeExpiresAt
};

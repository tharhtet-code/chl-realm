#!/usr/bin/env tsx
import crypto from 'node:crypto';

function simulateXApiGateway() {
  const sampleCompletion = {
    employeeName: 'Ma Su Myat',
    employeeEmail: 'sumyat@cmhl.cityholdings.com',
    businessUnit: 'CMHL',
    questId: 'val_integrity_01',
    questTitle: 'The Honest Checkout & Community Trust',
    lmsHook: 'module_core_values_2026',
    campaign: 'City_Holdings_Core_Values',
    world: 'Retail_Realm',
    score: 3,
    maxScore: 3,
    xpEarned: 200,
    badgeUnlocked: 'Integrity_Seed',
    itemUnlocked: 'Purple_CMHL_Apron',
    durationSeconds: 145,
  };

  const statement = {
    id: crypto.randomUUID(),
    actor: {
      objectType: 'Agent',
      name: sampleCompletion.employeeName,
      mbox: `mailto:${sampleCompletion.employeeEmail}`,
      account: {
        homePage: 'https://sso.cityholdings.com/realms/city-holdings',
        name: sampleCompletion.employeeEmail,
      },
    },
    verb: {
      id: 'http://adlnet.gov/expapi/verbs/completed',
      display: { 'en-US': 'completed' },
    },
    object: {
      objectType: 'Activity',
      id: `https://lms.cityholdings.com/activities/${sampleCompletion.lmsHook}`,
      definition: {
        name: { 'en-US': `${sampleCompletion.questTitle} (${sampleCompletion.questId})` },
        description: {
          'en-US': `In-game quest completion in ${sampleCompletion.world} (${sampleCompletion.campaign})`,
        },
        type: 'http://adlnet.gov/expapi/activities/assessment',
      },
    },
    result: {
      score: {
        scaled: 1.0,
        raw: sampleCompletion.score,
        min: 0,
        max: sampleCompletion.maxScore,
      },
      success: true,
      completion: true,
      duration: `PT${sampleCompletion.durationSeconds}S`,
      extensions: {
        'https://realm.cityholdings.com/xapi/ext/xp_earned': sampleCompletion.xpEarned,
        'https://realm.cityholdings.com/xapi/ext/badge': sampleCompletion.badgeUnlocked,
        'https://realm.cityholdings.com/xapi/ext/item_unlock': sampleCompletion.itemUnlocked,
      },
    },
    context: {
      registration: crypto.randomUUID(),
      platform: 'CHL Realm (Antigravity 3D Engine)',
      extensions: {
        'https://realm.cityholdings.com/xapi/ext/business_unit': sampleCompletion.businessUnit,
        'https://realm.cityholdings.com/xapi/ext/world': sampleCompletion.world,
      },
    },
    timestamp: new Date().toISOString(),
  };

  console.log('==============================================================');
  console.log('  CHL REALM :: SERVERLESS LMS xAPI GATEWAY SIMULATOR');
  console.log('==============================================================');
  console.log(JSON.stringify(statement, null, 2));
  console.log('--------------------------------------------------------------');
  console.log('Status: Ready to dispatch to Corporate LMS LRS (xAPI 1.0.3).');
}

simulateXApiGateway();

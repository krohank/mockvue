import http from 'http';

const BASE_URL = 'http://localhost:5000/api';

const request = (path, method = 'GET', data = null, token = null) => {
  return new Promise((resolve, reject) => {
    const url = new URL(BASE_URL + path);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method,
      headers: {
        'Content-Type': 'application/json',
      },
    };

    if (token) {
      options.headers['Authorization'] = `Bearer ${token}`;
    }

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => (body += chunk));
      res.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          if (res.statusCode >= 400) {
            reject(new Error(parsed.message || `HTTP ${res.statusCode}`));
          } else {
            resolve(parsed);
          }
        } catch {
          resolve(body);
        }
      });
    });

    req.on('error', reject);
    if (data) req.write(JSON.stringify(data));
    req.end();
  });
};

async function runProctoringTest() {
  console.log('🧪 Starting Proctoring & Full-Screen Termination Test...');

  // 1. Register candidate
  const email = `proctor_test_${Date.now()}@college.edu`;
  const regRes = await request('/auth/register', 'POST', {
    name: 'Proctoring Candidate',
    email,
    password: 'password123',
    targetRole: 'Software Development Engineer',
  });
  const token = regRes.token;
  console.log('   ✓ Registered candidate.');

  // 2. Generate interview
  const intRes = await request('/interviews/generate', 'POST', {
    targetRole: 'Software Development Engineer',
    topics: ['Operating Systems', 'System Design'],
    difficulty: 'Medium',
    questionCount: 3,
    mode: 'assessment',
  }, token);
  const interviewId = intRes.interviewId;
  console.log(`   ✓ Interview session created: [${interviewId}]`);

  // 3. Start interview
  await request(`/interviews/${interviewId}/start`, 'POST', {}, token);
  console.log('   ✓ Interview transitioned to in_progress.');

  // 4. Log monitoring events (camera & tab switch & fullscreen_exit)
  const monRes1 = await request(`/interviews/${interviewId}/monitoring`, 'POST', {
    eventType: 'camera_disconnected',
    confidence: 0.95,
    description: 'Webcam feed disconnected unexpectedly.',
  }, token);
  console.log('   ✓ Logged camera_disconnected to /api/interviews/:id/monitoring.');

  const monRes2 = await request(`/interviews/${interviewId}/monitoring`, 'POST', {
    eventType: 'fullscreen_exit',
    confidence: 1.0,
    description: 'Candidate exited full-screen proctoring mode.',
  }, token);
  console.log('   ✓ Logged fullscreen_exit to /api/interviews/:id/monitoring.');

  // 5. Query monitoring events
  const getMon = await request(`/interviews/${interviewId}/monitoring`, 'GET', null, token);
  console.log(`   ✓ Retrieved ${getMon.count} monitoring events.`);

  // 6. Terminate interview on full-screen exit
  const termRes = await request(`/interviews/${interviewId}/complete`, 'POST', {
    terminated: true,
    reason: 'Exam terminated: Full-screen mode was exited.',
  }, token);
  console.log(`   ✓ Completed with termination status: [${termRes.status}] Reason: ${termRes.terminationReason}`);

  // 7. Fetch report and verify termination details
  const reportRes = await request(`/interviews/${interviewId}/report`, 'GET', null, token);
  if (reportRes.interview.status === 'terminated' || reportRes.interview.terminationReason) {
    console.log('   ✓ Report correctly includes proctoring termination reason.');
  } else {
    throw new Error('Termination reason not present in report.');
  }

  console.log('🎉 PROCTORING & FULL-SCREEN TERMINATION TESTS PASSED!');
}

runProctoringTest().catch((err) => {
  console.error('❌ Proctoring test failed:', err);
  process.exit(1);
});

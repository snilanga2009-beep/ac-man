const axios = require('axios');

async function testLogins() {
  const accounts = [
    { u: 'admin@coolair.lk', p: 'password123' },
    { u: 'ruwan@coolair.lk', p: 'password123' },
    { u: 'abcadmin', p: 'password123' },
    { u: 'kasun_tech', p: 'password123' },
    { u: 'superadmin', p: 'superadmin123' }
  ];

  for (const acc of accounts) {
    try {
      const res = await axios.post('http://127.0.0.1:5000/api/auth/login', {
        username: acc.u,
        password: acc.p
      });
      console.log(`✓ SUCCESS: ${acc.u} -> Role: ${res.data.user.role}, Token: ${res.data.token.substring(0, 15)}...`);
    } catch (err) {
      console.error(`✗ FAILED: ${acc.u} -> ${err.response?.status}: ${err.response?.data?.error || err.message}`);
    }
  }
}

testLogins();

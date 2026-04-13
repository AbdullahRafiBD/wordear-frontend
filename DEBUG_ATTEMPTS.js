// Debug Helper for Quiz Attempts
// Copy this ENTIRE block into your browser console (F12)

window.debugAttempts = {
  // Check if API is accessible
  async testAPI() {
    try {
      const token = localStorage.getItem('auth_token');
      console.log('📌 Auth Token:', token ? 'Found ✅' : 'Not found ❌');

      const response = await fetch('http://localhost:8000/api/attempts', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      console.log('📌 API Response Status:', response.status);
      const data = await response.json();
      console.log('📌 API Response:', data);
      return data;
    } catch (error) {
      console.error('❌ API Error:', error);
    }
  },

  // Try to save a test attempt
  async testSave() {
    try {
      const token = localStorage.getItem('auth_token');
      const testAttempt = {
        attempts: [
          {
            word: 'test',
            user_answer: 'test',
            category: 'T',
            is_correct: true
          }
        ]
      };

      console.log('📌 Sending attempt:', testAttempt);

      const response = await fetch('http://localhost:8000/api/attempts', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(testAttempt)
      });

      console.log('📌 Save Response Status:', response.status);
      const data = await response.json();
      console.log('📌 Save Response:', data);
      return data;
    } catch (error) {
      console.error('❌ Save Error:', error);
    }
  },

  // Monitor the saveAttempts call
  monitorSave() {
    console.log('🔍 Starting to monitor saveAttempts...');
    console.log('Complete a quiz. Check console for logs.');
  }
};

console.log('✅ Debug helper loaded! Use:');
console.log('  window.debugAttempts.testAPI()        - Test if API is working');
console.log('  window.debugAttempts.testSave()       - Try saving a test attempt');
console.log('  window.debugAttempts.monitorSave()    - Monitor save calls');

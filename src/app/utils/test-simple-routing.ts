// Test script for the simple URL routing system
// You can run this in the browser console to test the new system

export async function testSimpleRouting() {
  console.log('🧪 Testing Simple URL Routing System');
  console.log('===================================');
  
  try {
    // Check what's available globally
    if (typeof window !== 'undefined' && window.vennSimpleUrlRouting) {
      console.log('✅ Simple URL routing functions available');
      
      // Test the debug function
      await window.vennSimpleUrlRouting.debugSimpleUrlSystem();
      
    } else {
      console.log('❌ Simple URL routing functions not available');
      console.log('   Make sure you are on the sitemap application page');
    }
    
    if (typeof window !== 'undefined' && window.vennDataCleanup) {
      console.log('✅ Data cleanup functions available');
      console.log('   You can run: window.vennDataCleanup.showCurrentData()');
      console.log('   Or clear data: window.vennDataCleanup.clearAllData()');
    } else {
      console.log('❌ Data cleanup functions not available');
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Make available globally
if (typeof window !== 'undefined') {
  (window as any).testSimpleRouting = testSimpleRouting;
  
  console.log('🔧 Test function available: testSimpleRouting()');
  console.log('📊 Data functions: window.vennDataCleanup.showCurrentData()');
  console.log('🧹 Clear data: window.vennDataCleanup.clearAllData()');
  console.log('🔗 URL routing: window.vennSimpleUrlRouting.debugSimpleUrlSystem()');
}
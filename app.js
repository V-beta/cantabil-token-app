rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    match /employees/{employeeId} {
      allow read: if true;
      allow create, update: if true; 
    }
    
    match /tokens/{tokenId} {
      allow read: if true;
      allow create: if true;
      allow update, delete: if false;
    }

    // 🔥 Naya rule Admin Menu ke liye
    match /menus/{menuId} {
      allow read: if true;
      allow write: if true;
    }
    
  }
}

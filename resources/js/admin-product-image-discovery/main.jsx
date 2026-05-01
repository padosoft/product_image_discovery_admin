import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import '../../css/admin-product-image-discovery.css';

const mount = document.getElementById('product-image-discovery-admin');

if (mount) {
  createRoot(mount).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
}

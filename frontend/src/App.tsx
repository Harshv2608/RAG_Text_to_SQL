import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Layout } from './components/Layout';
import { LiveRunner } from './pages/LiveRunner';
import { EvalDashboard } from './pages/EvalDashboard';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<LiveRunner />} />
          <Route path="eval" element={<EvalDashboard />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;

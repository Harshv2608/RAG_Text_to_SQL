
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Layout } from './components/Layout';
import { LiveRunner } from './pages/LiveRunner';
import { EvalDashboard } from './pages/EvalDashboard';
import { DatasetDashboard } from './pages/DatasetDashboard';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<LiveRunner />} />
          <Route path="eval" element={<EvalDashboard />} />
          <Route path="dataset" element={<DatasetDashboard />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;

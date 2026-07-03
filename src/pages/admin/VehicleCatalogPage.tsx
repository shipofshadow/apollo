import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  fetchAdminVehicleMakesApi,
  createAdminVehicleMakeApi,
  deleteAdminVehicleMakeApi,
  fetchAdminVehicleModelsApi,
  createAdminVehicleModelApi,
} from '../../services/api';

export default function VehicleCatalogPage(): React.ReactElement {
  const { token } = useAuth();
  const [makes, setMakes] = useState<Array<{ id: number; name: string }>>([]);
  const [selectedMakeId, setSelectedMakeId] = useState<number | null>(null);
  const [models, setModels] = useState<string[]>([]);
  const [newMake, setNewMake] = useState('');
  const [newModel, setNewModel] = useState('');

  useEffect(() => {
    if (!token) return;
    fetchAdminVehicleMakesApi(token).then(res => setMakes(res.makes || [])).catch(() => setMakes([]));
  }, [token]);

  useEffect(() => {
    if (!token || selectedMakeId === null) return;
    const make = makes.find(m => m.id === selectedMakeId);
    if (!make) return;
    fetchAdminVehicleModelsApi(token, make.name).then(res => setModels(res.models || [])).catch(() => setModels([]));
  }, [token, selectedMakeId, makes]);

  const onAddMake = async () => {
    if (!token || newMake.trim() === '') return;
    try {
      const res = await createAdminVehicleMakeApi(token, newMake.trim());
      setMakes(prev => [...prev, { id: res.id, name: res.name }]);
      setNewMake('');
    } catch (e) {
      console.error(e);
    }
  };

  const onDeleteMake = async (id: number) => {
    if (!token) return;
    try {
      await deleteAdminVehicleMakeApi(token, id);
      setMakes(prev => prev.filter(m => m.id !== id));
      if (selectedMakeId === id) {
        setSelectedMakeId(null);
        setModels([]);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const onAddModel = async () => {
    if (!token || selectedMakeId === null || newModel.trim() === '') return;
    try {
      const res = await createAdminVehicleModelApi(token, selectedMakeId, newModel.trim());
      setModels(prev => [...prev, res.name]);
      setNewModel('');
    } catch (e) {
      console.error(e);
    }
  };

  const onDeleteModel = async (_name: string) => {
    // We don't have model id from the admin models list; this delete path assumes
    // the backend provides delete by id. For now the admin UI will not delete
    // models until a future enhancement that returns ids. This keeps the UI safe.
    console.warn('Model delete by name is not implemented yet.');
  };

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold mb-4">Vehicle Catalog</h2>

      <section className="mb-6">
        <h3 className="font-semibold mb-2">Makes</h3>
        <div className="flex gap-2 mb-4">
          <input value={newMake} onChange={e => setNewMake(e.target.value)} className="px-2 py-1 bg-gray-800 text-white rounded" placeholder="New make name" />
          <button onClick={onAddMake} className="bg-brand-orange px-3 py-1 rounded text-white">Add Make</button>
        </div>
        <ul>
          {makes.map(m => (
            <li key={m.id} className="flex justify-between items-center mb-2">
              <button onClick={() => setSelectedMakeId(m.id)} className="text-left text-white">{m.name}</button>
              <button onClick={() => onDeleteMake(m.id)} className="text-red-400">Delete</button>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h3 className="font-semibold mb-2">Models</h3>
        {selectedMakeId === null ? (
          <p className="text-gray-400">Select a make to view its models.</p>
        ) : (
          <>
            <div className="flex gap-2 mb-4">
              <input value={newModel} onChange={e => setNewModel(e.target.value)} className="px-2 py-1 bg-gray-800 text-white rounded" placeholder="New model name" />
              <button onClick={onAddModel} className="bg-brand-orange px-3 py-1 rounded text-white">Add Model</button>
            </div>
            <ul>
              {models.map((mo, idx) => (
                <li key={idx} className="flex justify-between items-center mb-2">
                  <span className="text-white">{mo}</span>
                  <button onClick={() => onDeleteModel(mo)} className="text-red-400">Delete</button>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>
    </div>
  );
}

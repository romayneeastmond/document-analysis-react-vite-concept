
import React from 'react';
import { Settings as SettingsIcon } from 'lucide-react';

export const SettingsPanel = () => {
    return (
        <div className="h-full flex flex-col bg-white relative animate-in fade-in duration-300">
            <div className="h-14 border-b border-gray-200 flex items-center px-6 shrink-0">
                <div className="flex items-center space-x-2">
                    <SettingsIcon className="w-4 h-4 text-gray-500" />
                    <h2 className="text-sm font-medium text-gray-900">Settings</h2>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
                <div className="max-w-2xl mx-auto space-y-8">
                    <section>
                        <div className="flex items-center space-x-2 mb-4">
                            <div className="p-1.5 bg-green-100 rounded-md">
                                <SettingsIcon className="w-4 h-4 text-green-700" />
                            </div>
                            <h3 className="text-base font-medium text-gray-900">System</h3>
                        </div>
                        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm space-y-6">
                            <div className="flex items-center justify-between">
                                <div className="space-y-0.5">
                                    <label className="text-sm font-medium text-gray-900">Initialize Database</label>
                                    <p className="text-xs text-gray-500">Run setup script to create database and containers.</p>
                                </div>
                                <button
                                    onClick={async () => {
                                        if (confirm('Are you sure you want to run the database setup? This will create resources if they do not exist.')) {
                                            try {
                                                const { setupCosmosDB } = await import('../services/cosmodb-setup');

                                                await setupCosmosDB();

                                                alert('Database initialized successfully!');

                                            } catch (_error) {
                                                alert('Failed to initialize database. Check console for details.');
                                            }
                                        }
                                    }}
                                    className="px-3 py-1.5 bg-gray-900 text-white text-xs font-medium rounded-md hover:bg-gray-800 transition-colors"
                                >
                                    Run Setup
                                </button>
                            </div>
                        </div>
                    </section>
                </div>
            </div>
        </div>
    );
};

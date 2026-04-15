import { Bell, User, Palette, Database } from "lucide-react";
import { Label } from "../components/ui/label";
import { Switch } from "../components/ui/switch";
import { Input } from "../components/ui/input";
import { Button } from "../components/ui/button";

export function SettingsScreen() {
  return (
    <div className="min-h-full bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-8 mb-6">
          <h1 className="text-2xl font-semibold text-gray-900 mb-2">Settings</h1>
          <p className="text-gray-600">Manage your Idea Palette preferences</p>
        </div>

        <div className="space-y-6">
          {/* User Profile */}
          <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-6">
            <div className="flex items-center gap-3 mb-6">
              <User className="w-5 h-5 text-gray-600" />
              <h2 className="font-medium text-gray-900">User Profile</h2>
            </div>
            <div className="space-y-4">
              <div>
                <Label htmlFor="username">Username</Label>
                <Input id="username" defaultValue="Research User" className="mt-1.5" />
              </div>
              <div>
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" defaultValue="user@example.com" className="mt-1.5" />
              </div>
            </div>
          </div>

          {/* Palette Settings */}
          <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-6">
            <div className="flex items-center gap-3 mb-6">
              <Palette className="w-5 h-5 text-gray-600" />
              <h2 className="font-medium text-gray-900">Palette Preferences</h2>
            </div>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Auto-save paints</Label>
                  <p className="text-sm text-gray-500">Automatically save extracted paints</p>
                </div>
                <Switch defaultChecked />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label>Show transformation trails</Label>
                  <p className="text-sm text-gray-500">Display paint modification history</p>
                </div>
                <Switch defaultChecked />
              </div>
            </div>
          </div>

          {/* Notifications */}
          <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-6">
            <div className="flex items-center gap-3 mb-6">
              <Bell className="w-5 h-5 text-gray-600" />
              <h2 className="font-medium text-gray-900">Notifications</h2>
            </div>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label>AI suggestions</Label>
                  <p className="text-sm text-gray-500">Get AI-powered interpretation suggestions</p>
                </div>
                <Switch defaultChecked />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label>Session reminders</Label>
                  <p className="text-sm text-gray-500">Remind me to continue unfinished sessions</p>
                </div>
                <Switch />
              </div>
            </div>
          </div>

          {/* Data & Privacy */}
          <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-6">
            <div className="flex items-center gap-3 mb-6">
              <Database className="w-5 h-5 text-gray-600" />
              <h2 className="font-medium text-gray-900">Data & Privacy</h2>
            </div>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Research data collection</Label>
                  <p className="text-sm text-gray-500">Help improve the system by sharing anonymized usage data</p>
                </div>
                <Switch defaultChecked />
              </div>
              <div className="pt-4 border-t border-gray-200">
                <Button variant="outline" className="w-full">
                  Export all session data
                </Button>
              </div>
              <div>
                <Button variant="outline" className="w-full text-red-600 hover:text-red-700">
                  Delete all sessions
                </Button>
              </div>
            </div>
          </div>

          {/* Save Button */}
          <div className="flex justify-end gap-3">
            <Button variant="outline">Cancel</Button>
            <Button className="bg-blue-500 hover:bg-blue-600">Save Changes</Button>
          </div>
        </div>
      </div>
    </div>
  );
}
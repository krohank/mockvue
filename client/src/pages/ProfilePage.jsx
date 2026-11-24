import React, { useState } from 'react';
import { Save, Check, AlertCircle, User, Shield } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/Button';
import { Card, CardHeader, CardBody } from '../components/ui/Card';

export const ProfilePage = () => {
  const { user, updateProfile } = useAuth();

  const [name, setName] = useState(user?.name || '');
  const [targetRole, setTargetRole] = useState(user?.targetRole || 'Software Development Engineer');
  const [experienceLevel, setExperienceLevel] = useState(user?.experienceLevel || 'Entry-Level');
  const [preferredTopics, setPreferredTopics] = useState(
    user?.preferredTopics || ['Data Structures & Algorithms', 'Database Management Systems']
  );
  const [bio, setBio] = useState(user?.bio || '');
  const [statusMessage, setStatusMessage] = useState({ type: '', text: '' });
  const [isSaving, setIsSaving] = useState(false);

  const availableTopics = [
    'Data Structures & Algorithms',
    'Database Management Systems',
    'Operating Systems',
    'Computer Networks',
    'System Design',
    'Object-Oriented Programming',
    'JavaScript & TypeScript',
    'React & Frontend Architecture',
    'Node.js & Backend Architecture',
    'SQL & Data Modeling',
    'Python Programming',
    'Java & Spring Boot',
  ];

  const handleTopicToggle = (topic) => {
    if (preferredTopics.includes(topic)) {
      if (preferredTopics.length === 1) return;
      setPreferredTopics(preferredTopics.filter((t) => t !== topic));
    } else {
      setPreferredTopics([...preferredTopics, topic]);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setStatusMessage({ type: '', text: '' });
    setIsSaving(true);

    try {
      await updateProfile({
        name,
        targetRole,
        experienceLevel,
        preferredTopics,
        bio,
      });
      setStatusMessage({ type: 'success', text: 'Changes saved.' });
    } catch (err) {
      setStatusMessage({ type: 'error', text: err.message || 'Failed to update profile.' });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6 animate-fade-in font-sans">
      <div className="pb-5 border-b border-[#DED9D0] dark:border-[#332F2A]">
        <span className="font-mono text-[10px] font-semibold uppercase tracking-wider text-[#68645E] dark:text-[#9E988F]">
          Your account
        </span>
        <h1 className="text-2xl sm:text-3xl font-serif font-bold text-[#171717] dark:text-[#F7F4EE] tracking-tight">
          Profile
        </h1>
        <p className="text-xs text-[#68645E] dark:text-[#9E988F] mt-0.5 font-mono">
          Choose the role and topics you want to practice.
        </p>
      </div>

      {statusMessage.text && (
        <div
          className={`p-3.5 rounded-lg flex items-center gap-2.5 text-xs font-mono ${
            statusMessage.type === 'success'
              ? 'bg-[#EFF5F1] dark:bg-[#3F6B52]/20 border border-[#C2D9CB] dark:border-[#3F6B52]/40 text-[#3F6B52] dark:text-[#88BA9D]'
              : 'bg-[#FAF0F0] dark:bg-[#A33B3B]/20 border border-[#E8C4C4] dark:border-[#A33B3B]/40 text-[#A33B3B] dark:text-[#E59797]'
          }`}
        >
          {statusMessage.type === 'success' ? (
            <Check className="w-4 h-4 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 shrink-0" />
          )}
          <span>{statusMessage.text}</span>
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6">
        <Card className="shadow-paper">
          <CardHeader
            title="About you"
            subtitle="Your details and interview preferences"
          />
          <CardBody className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="profile-name" className="block text-xs font-mono font-medium text-[#171717] dark:text-[#F7F4EE] uppercase tracking-wider mb-1.5">
                  Full Name
                </label>
                <input id="profile-name"
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-[8px] border border-[#DED9D0] dark:border-[#332F2A] bg-[#FFFDF9] dark:bg-[#141210] text-[#171717] dark:text-[#F7F4EE] text-sm focus:outline-none focus:border-[#7A263A] focus:ring-1 focus:ring-[#7A263A]/30"
                />
              </div>

              <div>
                <label htmlFor="profile-email" className="block text-xs font-mono font-medium text-[#171717] dark:text-[#F7F4EE] uppercase tracking-wider mb-1.5">
                  Email Address
                </label>
                <input id="profile-email"
                  type="email"
                  disabled
                  value={user?.email || ''}
                  className="w-full px-3.5 py-2 rounded-[8px] border border-[#DED9D0] dark:border-[#332F2A] bg-[#F0ECE4] dark:bg-[#24201C] text-[#68645E] dark:text-[#9E988F] text-sm cursor-not-allowed font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="profile-role" className="block text-xs font-mono font-medium text-[#171717] dark:text-[#F7F4EE] uppercase tracking-wider mb-1.5">
                  Target role
                </label>
                <select id="profile-role"
                  value={targetRole}
                  onChange={(e) => setTargetRole(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-[8px] border border-[#DED9D0] dark:border-[#332F2A] bg-[#FFFDF9] dark:bg-[#141210] text-[#171717] dark:text-[#F7F4EE] text-sm focus:outline-none focus:border-[#7A263A] focus:ring-1 focus:ring-[#7A263A]/30 font-sans"
                >
                  <option value="Software Development Engineer">Software Development Engineer (SDE)</option>
                  <option value="Frontend Developer">Frontend Developer</option>
                  <option value="Backend Developer">Backend Developer</option>
                  <option value="Full Stack Developer">Full Stack Developer</option>
                  <option value="Data Analyst">Data Analyst</option>
                  <option value="Java Developer">Java Developer</option>
                  <option value="Python Developer">Python Developer</option>
                  <option value="DevOps Engineer">DevOps Engineer</option>
                </select>
              </div>

              <div>
                <label htmlFor="profile-experience" className="block text-xs font-mono font-medium text-[#171717] dark:text-[#F7F4EE] uppercase tracking-wider mb-1.5">
                  Experience level
                </label>
                <select id="profile-experience"
                  value={experienceLevel}
                  onChange={(e) => setExperienceLevel(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-[8px] border border-[#DED9D0] dark:border-[#332F2A] bg-[#FFFDF9] dark:bg-[#141210] text-[#171717] dark:text-[#F7F4EE] text-sm focus:outline-none focus:border-[#7A263A] focus:ring-1 focus:ring-[#7A263A]/30 font-sans"
                >
                  <option value="Entry-Level">Entry-Level (Campus Placements / Fresh Graduate)</option>
                  <option value="Junior">Junior (0–2 Years Experience)</option>
                  <option value="Mid-Level">Mid-Level (2–5 Years Experience)</option>
                  <option value="Senior">Senior (5+ Years Experience)</option>
                </select>
              </div>
            </div>

            <div>
              <label htmlFor="profile-bio" className="block text-xs font-mono font-medium text-[#171717] dark:text-[#F7F4EE] uppercase tracking-wider mb-1.5">
                About you
              </label>
              <textarea id="profile-bio"
                rows="3"
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="What role are you preparing for? What would you like to improve?"
                className="w-full px-3.5 py-2 rounded-[8px] border border-[#DED9D0] dark:border-[#332F2A] bg-[#FFFDF9] dark:bg-[#141210] text-[#171717] dark:text-[#F7F4EE] text-sm focus:outline-none focus:border-[#7A263A] focus:ring-1 focus:ring-[#7A263A]/30 leading-relaxed font-sans"
              />
            </div>
          </CardBody>
        </Card>

        {/* Preferred Placement Topics */}
        <Card className="shadow-paper">
          <CardHeader
            title="Preferred topics"
            subtitle="These topics will be selected by default for new interviews."
          />
          <CardBody>
            <div className="flex flex-wrap gap-2">
              {availableTopics.map((topic) => {
                const isSelected = preferredTopics.includes(topic);
                return (
                  <button
                    key={topic}
                    type="button"
                    onClick={() => handleTopicToggle(topic)}
                    className={`px-3 py-1.5 rounded-[8px] font-mono text-xs font-medium transition-all border ${
                      isSelected
                        ? 'bg-[#7A263A] text-[#FFFDF9] border-[#7A263A] shadow-tactile'
                        : 'bg-[#FFFDF9] dark:bg-[#141210] text-[#171717] dark:text-[#F7F4EE] border-[#DED9D0] dark:border-[#332F2A] hover:bg-[#F0ECE4] dark:hover:bg-[#24201C]'
                    }`}
                  >
                    {isSelected ? '✓ ' : '+ '}
                    {topic}
                  </button>
                );
              })}
            </div>
          </CardBody>
        </Card>

        <div className="flex justify-end pt-1">
          <Button type="submit" size="md" icon={Save} isLoading={isSaving}>
            Save changes
          </Button>
        </div>
      </form>
    </div>
  );
};

export default ProfilePage;

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { JobRoleConfig, CriteriaCategory, Criterion, DEFAULT_CATEGORIES } from '@/types/evaluation';
import { Plus, Trash2, GripVertical, Settings2, Copy } from 'lucide-react';

interface Props {
  jobRoles: JobRoleConfig[];
  onUpdateRole: (id: string, updates: Partial<JobRoleConfig>) => void;
  onAddRole: (role: JobRoleConfig) => void;
  onDeleteRole: (id: string) => void;
  onUpdateCategories: (roleId: string, categories: CriteriaCategory[]) => void;
}

export function ConfigPanel({ jobRoles, onUpdateRole, onAddRole, onDeleteRole, onUpdateCategories }: Props) {
  const [selectedRoleId, setSelectedRoleId] = useState(jobRoles[0]?.id || '');
  const [newRoleName, setNewRoleName] = useState('');
  const [newCriterionName, setNewCriterionName] = useState('');
  const [newCriterionDesc, setNewCriterionDesc] = useState('');
  const [addingToCategoryId, setAddingToCategoryId] = useState<string | null>(null);
  const [newCategoryName, setNewCategoryName] = useState('');

  const selectedRole = jobRoles.find(r => r.id === selectedRoleId);

  const handleAddRole = () => {
    if (!newRoleName.trim()) return;
    const newRole: JobRoleConfig = {
      id: crypto.randomUUID(),
      name: newRoleName.trim(),
      categories: JSON.parse(JSON.stringify(DEFAULT_CATEGORIES)),
      scaleMax: 4,
    };
    onAddRole(newRole);
    setNewRoleName('');
    setSelectedRoleId(newRole.id);
  };

  const handleDuplicateRole = () => {
    if (!selectedRole) return;
    const dup: JobRoleConfig = {
      ...JSON.parse(JSON.stringify(selectedRole)),
      id: crypto.randomUUID(),
      name: `${selectedRole.name} (Copy)`,
    };
    onAddRole(dup);
    setSelectedRoleId(dup.id);
  };

  const updateWeight = (categoryId: string, criterionId: string, weight: number) => {
    if (!selectedRole) return;
    const cats = selectedRole.categories.map(cat => {
      if (cat.id !== categoryId) return cat;
      return {
        ...cat,
        criteria: cat.criteria.map(c => c.id === criterionId ? { ...c, weight } : c),
      };
    });
    onUpdateCategories(selectedRole.id, cats);
  };

  const removeCriterion = (categoryId: string, criterionId: string) => {
    if (!selectedRole) return;
    const cats = selectedRole.categories.map(cat => {
      if (cat.id !== categoryId) return cat;
      return { ...cat, criteria: cat.criteria.filter(c => c.id !== criterionId) };
    });
    onUpdateCategories(selectedRole.id, cats);
  };

  const addCriterion = (categoryId: string) => {
    if (!selectedRole || !newCriterionName.trim()) return;
    const newCrit: Criterion = {
      id: crypto.randomUUID(),
      name: newCriterionName.trim(),
      description: newCriterionDesc.trim(),
      weight: 1,
    };
    const cats = selectedRole.categories.map(cat => {
      if (cat.id !== categoryId) return cat;
      return { ...cat, criteria: [...cat.criteria, newCrit] };
    });
    onUpdateCategories(selectedRole.id, cats);
    setNewCriterionName('');
    setNewCriterionDesc('');
    setAddingToCategoryId(null);
  };

  const addCategory = () => {
    if (!selectedRole || !newCategoryName.trim()) return;
    const newCat: CriteriaCategory = {
      id: crypto.randomUUID(),
      name: newCategoryName.trim(),
      criteria: [],
    };
    onUpdateCategories(selectedRole.id, [...selectedRole.categories, newCat]);
    setNewCategoryName('');
  };

  const removeCategory = (categoryId: string) => {
    if (!selectedRole) return;
    onUpdateCategories(selectedRole.id, selectedRole.categories.filter(c => c.id !== categoryId));
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Settings2 className="h-5 w-5 text-primary" />
            Configuration Panel
          </CardTitle>
          <p className="text-sm text-muted-foreground">Customize evaluation criteria, weights, and categories per job role — no code required.</p>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Role selector */}
          <div className="flex gap-3 items-end">
            <div className="flex-1">
              <Label>Job Role</Label>
              <Select value={selectedRoleId} onValueChange={setSelectedRoleId}>
                <SelectTrigger><SelectValue placeholder="Select role" /></SelectTrigger>
                <SelectContent>
                  {jobRoles.map(r => (
                    <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button variant="outline" size="icon" onClick={handleDuplicateRole} title="Duplicate role">
              <Copy className="h-4 w-4" />
            </Button>
            {selectedRole && jobRoles.length > 1 && (
              <Button variant="destructive" size="icon" onClick={() => {
                onDeleteRole(selectedRoleId);
                setSelectedRoleId(jobRoles.find(r => r.id !== selectedRoleId)?.id || '');
              }}>
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>

          {/* Add new role */}
          <div className="flex gap-2">
            <Input
              value={newRoleName}
              onChange={e => setNewRoleName(e.target.value)}
              placeholder="New role name..."
              onKeyDown={e => e.key === 'Enter' && handleAddRole()}
            />
            <Button onClick={handleAddRole} variant="outline">
              <Plus className="h-4 w-4 mr-1" /> Add Role
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Categories & Criteria editor */}
      {selectedRole && (
        <>
          {selectedRole.categories.map(cat => (
            <Card key={cat.id}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">{cat.name}</CardTitle>
                  <div className="flex gap-2">
                    <Button variant="ghost" size="sm" onClick={() => setAddingToCategoryId(addingToCategoryId === cat.id ? null : cat.id)}>
                      <Plus className="h-3.5 w-3.5 mr-1" /> Add Criterion
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => removeCategory(cat.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {cat.criteria.map(crit => (
                  <div key={crit.id} className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 border">
                    <GripVertical className="h-4 w-4 text-muted-foreground shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{crit.name}</p>
                      <p className="text-xs text-muted-foreground">{crit.description}</p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <div className="w-32">
                        <Label className="text-[10px] text-muted-foreground">Weight: ×{crit.weight}</Label>
                        <Slider
                          value={[crit.weight]}
                          onValueChange={([v]) => updateWeight(cat.id, crit.id, v)}
                          min={1}
                          max={5}
                          step={1}
                          className="mt-1"
                        />
                      </div>
                      <Badge variant="secondary">×{crit.weight}</Badge>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => removeCriterion(cat.id, crit.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}

                {addingToCategoryId === cat.id && (
                  <div className="flex gap-2 p-3 border border-dashed rounded-lg">
                    <Input
                      value={newCriterionName}
                      onChange={e => setNewCriterionName(e.target.value)}
                      placeholder="Criterion name"
                      className="flex-1"
                    />
                    <Input
                      value={newCriterionDesc}
                      onChange={e => setNewCriterionDesc(e.target.value)}
                      placeholder="Description"
                      className="flex-1"
                    />
                    <Button size="sm" onClick={() => addCriterion(cat.id)}>Add</Button>
                  </div>
                )}

                {cat.criteria.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">No criteria yet. Click "Add Criterion" to start.</p>
                )}
              </CardContent>
            </Card>
          ))}

          {/* Add new category */}
          <Card className="border-dashed">
            <CardContent className="py-4">
              <div className="flex gap-2">
                <Input
                  value={newCategoryName}
                  onChange={e => setNewCategoryName(e.target.value)}
                  placeholder="New category name..."
                  onKeyDown={e => e.key === 'Enter' && addCategory()}
                />
                <Button onClick={addCategory} variant="outline">
                  <Plus className="h-4 w-4 mr-1" /> Add Category
                </Button>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

import { useState, useRef, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useLanguage } from '@/i18n/LanguageContext';
import { toast } from 'sonner';
import { Upload, Pen, Trash2, Save } from 'lucide-react';

export function SignatureManager() {
  const { t } = useLanguage();
  const { user, profile, refreshProfile } = useAuth();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasDrawn, setHasDrawn] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
  }, []);

  const getPos = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    if ('touches' in e) {
      return { x: e.touches[0].clientX - rect.left, y: e.touches[0].clientY - rect.top };
    }
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const startDraw = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    setIsDrawing(true);
    const ctx = canvasRef.current!.getContext('2d')!;
    const { x, y } = getPos(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing) return;
    e.preventDefault();
    const ctx = canvasRef.current!.getContext('2d')!;
    const { x, y } = getPos(e);
    ctx.lineTo(x, y);
    ctx.stroke();
    setHasDrawn(true);
  };

  const stopDraw = () => setIsDrawing(false);

  const clearCanvas = () => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    setHasDrawn(false);
  };

  const uploadSignature = async (blob: Blob) => {
    if (!user) return;
    const path = `${user.id}/signature.png`;
    await supabase.storage.from('signatures').upload(path, blob, { upsert: true, contentType: 'image/png' });
    const { data } = supabase.storage.from('signatures').getPublicUrl(path);
    await supabase.from('profiles').update({ signature_url: `${data.publicUrl}?t=${Date.now()}` }).eq('user_id', user.id);
    await refreshProfile();
    toast.success(t('signatureSaved'));
  };

  const handleSaveDrawing = async () => {
    const canvas = canvasRef.current!;
    canvas.toBlob(blob => { if (blob) uploadSignature(blob); }, 'image/png');
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await uploadSignature(file);
  };

  const handleDelete = async () => {
    if (!user) return;
    await supabase.storage.from('signatures').remove([`${user.id}/signature.png`]);
    await supabase.from('profiles').update({ signature_url: null }).eq('user_id', user.id);
    await refreshProfile();
    toast.success(t('signatureDeleted'));
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Pen className="h-4 w-4" /> {t('mySignature')}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {profile?.signature_url && (
          <div className="space-y-2">
            <p className="text-sm font-medium">{t('currentSignature')}</p>
            <div className="border rounded-md p-3 bg-white inline-block">
              <img src={profile.signature_url} alt="Signature" className="max-h-20 object-contain" />
            </div>
            <Button variant="ghost" size="sm" onClick={handleDelete} className="gap-1 text-destructive">
              <Trash2 className="h-3 w-3" /> {t('remove')}
            </Button>
          </div>
        )}

        <Tabs defaultValue="draw">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="draw" className="gap-1"><Pen className="h-3 w-3" /> {t('drawSignature')}</TabsTrigger>
            <TabsTrigger value="upload" className="gap-1"><Upload className="h-3 w-3" /> {t('uploadSignature')}</TabsTrigger>
          </TabsList>

          <TabsContent value="draw" className="space-y-3">
            <canvas
              ref={canvasRef}
              width={400}
              height={150}
              className="border rounded-md cursor-crosshair w-full touch-none"
              onMouseDown={startDraw}
              onMouseMove={draw}
              onMouseUp={stopDraw}
              onMouseLeave={stopDraw}
              onTouchStart={startDraw}
              onTouchMove={draw}
              onTouchEnd={stopDraw}
            />
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={clearCanvas}>{t('clearAll')}</Button>
              <Button size="sm" onClick={handleSaveDrawing} disabled={!hasDrawn} className="gap-1">
                <Save className="h-3 w-3" /> {t('save')}
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="upload" className="space-y-3">
            <Button variant="outline" onClick={() => fileInputRef.current?.click()} className="gap-1">
              <Upload className="h-3 w-3" /> {t('uploadSignature')}
            </Button>
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileUpload} />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

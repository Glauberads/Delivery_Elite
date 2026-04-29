
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { RegionSettings } from './settings/RegionSettings';
import { DriverSettings } from './settings/DriverSettings';

export function DeliverySettings() {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Configurações de Entrega</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <RegionSettings />
          <DriverSettings />
        </CardContent>
      </Card>
    </div>
  );
}




/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License;
 * you may not use this file except in compliance with the Elastic License.
 */
/* eslint-disable @kbn/eslint/no-restricted-paths */
import React from 'react';
import { LocationDescriptorObject } from 'history';
import { ScopedHistory } from 'kibana/public';
import { KibanaContextProvider } from '../../../../../../src/plugins/kibana_react/public';
import {
  notificationServiceMock,
  fatalErrorsServiceMock,
  docLinksServiceMock,
  injectedMetadataServiceMock,
  scopedHistoryMock,
} from '../../../../../../src/core/public/mocks';

import { usageCollectionPluginMock } from '../../../../../../src/plugins/usage_collection/public/mocks';

// eslint-disable-next-line @kbn/eslint/no-restricted-paths
import { HttpService } from '../../../../../../src/core/public/http';

import {
  breadcrumbService,
  documentationService,
  uiMetricService,
  apiService,
} from '../../../public/application/services';

import { init as initHttpRequests } from './http_requests';

const httpServiceSetupMock = new HttpService().setup({
  injectedMetadata: injectedMetadataServiceMock.createSetupContract(),
  fatalErrors: fatalErrorsServiceMock.createSetupContract(),
});

const history = (scopedHistoryMock.create() as unknown) as ScopedHistory;
history.createHref = (location: LocationDescriptorObject) => {
  return `${location.pathname}?${location.search}`;
};

const appServices = {
  breadcrumbs: breadcrumbService,
  metric: uiMetricService,
  documentation: documentationService,
  api: apiService,
  notifications: notificationServiceMock.createSetupContract(),
  history,
};

export const setupEnvironment = () => {
  uiMetricService.setup(usageCollectionPluginMock.createSetupContract());
  apiService.setup(httpServiceSetupMock, uiMetricService);
  documentationService.setup(docLinksServiceMock.createStartContract());
  breadcrumbService.setup(() => {});

  const { server, httpRequestsMockHelpers } = initHttpRequests();

  return {
    server,
    httpRequestsMockHelpers,
  };
};

export const WithAppDependencies = (Comp: any) => (props: any) => (
  <KibanaContextProvider services={appServices}>
    <Comp {...props} />
  </KibanaContextProvider>
);

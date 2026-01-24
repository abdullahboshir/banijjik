import { Router } from 'express';
import { 
  MongoosePeopleRepository
} from '../../persistence';
import { JoinOrganizationUseCase } from '@people/application';
import { PeopleController } from '../controllers';

export const createPeopleRouter = () => {
  const router = Router();

  // 1. Repositories
  const personRepo = new MongoosePeopleRepository();

  // 2. Use Cases
  const joinOrgUseCase = new JoinOrganizationUseCase(personRepo);

  // 3. Controller
  const controller = new PeopleController(joinOrgUseCase);

  // 4. Routes
  router.post('/join', controller.joinOrganization.bind(controller));

  return router;
};

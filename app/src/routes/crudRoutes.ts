
import { Router, Request, Response, NextFunction } from 'express';
import { EntityTarget, ObjectLiteral } from 'typeorm';
import { AppDataSource } from '../config/database';

export function createCrudRouter(
    entity: EntityTarget<ObjectLiteral>,
    primaryKey: string,
    requiredFields: string[],
    allowedFields: string[],
) {
    const router = Router();
    const repository = () => AppDataSource.getRepository(entity);

    router.get('/', async (_req: Request, res: Response, next: NextFunction) => {
        try {
            const data = await repository().find();
            res.json({ count: data.length, data });
        } catch (error) {
            next(error);
        }
    });

    router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
        try {
            const id = Number(req.params.id);

            if (!Number.isSafeInteger(id) || id < 1) {
                res.status(400).json({ message: 'Invalid ID' });
                return;
            }

            const data = await repository().findOneBy({
                [primaryKey]: id,
            } as any);

            if (!data) {
                res.status(404).json({ message: 'Record not found' });
                return;
            }

            res.json(data);
        } catch (error) {
            next(error);
        }
    });

    router.post('/', async (req: Request, res: Response, next: NextFunction) => {
        try {
            const body = req.body;

            if (!body || typeof body !== 'object' || Array.isArray(body)) {
                res.status(400).json({ message: 'Request body must be an object' });
                return;
            }

            const invalid = Object.keys(body).filter(
                key => !allowedFields.includes(key),
            );

            if (invalid.length) {
                res.status(400).json({
                    message: 'Unknown or disallowed fields',
                    fields: invalid,
                });
                return;
            }

            const missing = requiredFields.filter(
                key => body[key] === undefined ||
                    body[key] === null ||
                    body[key] === '',
            );

            if (missing.length) {
                res.status(400).json({
                    message: 'Required fields missing',
                    fields: missing,
                });
                return;
            }

            const record = repository().create(body);
            const saved = await repository().save(record);

            res.status(201).json(saved);
        } catch (error) {
            next(error);
        }
    });

    router.patch('/:id', async (req: Request, res: Response, next: NextFunction) => {
        try {
            const id = Number(req.params.id);
            const body = req.body;

            if (!Number.isSafeInteger(id) || id < 1) {
                res.status(400).json({ message: 'Invalid ID' });
                return;
            }

            if (!body || typeof body !== 'object' || Array.isArray(body)) {
                res.status(400).json({ message: 'Request body must be an object' });
                return;
            }

            const invalid = Object.keys(body).filter(
                key => !allowedFields.includes(key),
            );

            if (invalid.length) {
                res.status(400).json({
                    message: 'Unknown or disallowed fields',
                    fields: invalid,
                });
                return;
            }

            if (Object.keys(body).length === 0) {
                res.status(400).json({ message: 'Provide at least one field' });
                return;
            }

            const repo = repository();
            const record = await repo.findOneBy({ [primaryKey]: id } as any);

            if (!record) {
                res.status(404).json({ message: 'Record not found' });
                return;
            }

            repo.merge(record, body);
            res.json(await repo.save(record));
        } catch (error) {
            next(error);
        }
    });

    router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
        try {
            const id = Number(req.params.id);

            if (!Number.isSafeInteger(id) || id < 1) {
                res.status(400).json({ message: 'Invalid ID' });
                return;
            }

            const result = await repository().delete({ [primaryKey]: id } as any);

            if (!result.affected) {
                res.status(404).json({ message: 'Record not found' });
                return;
            }

            res.status(204).send();
        } catch (error) {
            next(error);
        }
    });

    return router;
}

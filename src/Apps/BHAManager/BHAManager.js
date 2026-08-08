import React from 'react';
import Button from 'react-bootstrap/Button';
import Form from 'react-bootstrap/Form';

const BHAManager = ({
    currentBha,
    savedBhas = [],
    saveBha,
    loadBha,
    deleteBha,
    newBha
}) => {
    return (
        <div>
            <div className="d-flex gap-2 mb-3">
                <Button variant="secondary" onClick={newBha}>
                    New
                </Button>

                <Button variant="primary" onClick={saveBha}>
                    Save
                </Button>
            </div>

            <Form.Group>
                <Form.Label>Saved BHAs</Form.Label>

                <Form.Select
                    value={currentBha.id || ''}
                    onChange={(event) => loadBha(event.target.value)}
                >
                    <option value="">Select BHA...</option>

                    {savedBhas.map((bha) => (
                        <option key={bha.id} value={bha.id}>
                            {bha.name || `BHA ${bha.id}`}
                        </option>
                    ))}
                </Form.Select>
            </Form.Group>

            {currentBha.id && (
                <Button
                    className="mt-2"
                    variant="outline-danger"
                    onClick={() => deleteBha(currentBha.id)}
                >
                    Delete
                </Button>
            )}
        </div>
    );
};

export default BHAManager;
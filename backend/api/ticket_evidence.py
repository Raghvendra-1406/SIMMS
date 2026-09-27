from fastapi import APIRouter, HTTPException

from schemas.ticket_evidence_schema import (
    TicketEvidenceResponse,
)

from services.ticket_evidence_service import (
    get_evidence,
    get_all_ticket_evidence,
    get_ticket_detection_evidence,
    get_ticket_verification_evidence,
)


router = APIRouter(
    prefix="/ticket-evidence",
    tags=["Ticket Evidence"]
)


def evidence_to_response(evidence):
    return {
        "evidence_id": evidence[0],
        "ticket_id": evidence[1],
        "evidence_type": evidence[2],
        "evidence_data": evidence[3],
        "captured_at": evidence[4],
        "evidence_stage": evidence[5],
    }


@router.get(
    "/ticket/{ticket_id}",
    response_model=list[TicketEvidenceResponse]
)
def get_ticket_evidence_endpoint(ticket_id: int):
    try:
        evidence = get_all_ticket_evidence(ticket_id)

        return [
            evidence_to_response(item)
            for item in evidence
        ]

    except ValueError as exc:
        raise HTTPException(
            status_code=404,
            detail=str(exc)
        )


@router.get(
    "/ticket/{ticket_id}/detection",
    response_model=list[TicketEvidenceResponse]
)
def get_detection_evidence_endpoint(ticket_id: int):
    try:
        evidence = get_ticket_detection_evidence(ticket_id)

        return [
            evidence_to_response(item)
            for item in evidence
        ]

    except ValueError as exc:
        raise HTTPException(
            status_code=404,
            detail=str(exc)
        )


@router.get(
    "/ticket/{ticket_id}/verification",
    response_model=list[TicketEvidenceResponse]
)
def get_verification_evidence_endpoint(ticket_id: int):
    try:
        evidence = get_ticket_verification_evidence(ticket_id)

        return [
            evidence_to_response(item)
            for item in evidence
        ]

    except ValueError as exc:
        raise HTTPException(
            status_code=404,
            detail=str(exc)
        )


@router.get(
    "/{evidence_id}",
    response_model=TicketEvidenceResponse
)
def get_ticket_evidence_by_id_endpoint(evidence_id: int):
    try:
        evidence = get_evidence(evidence_id)

        return evidence_to_response(evidence)

    except ValueError as exc:
        raise HTTPException(
            status_code=404,
            detail=str(exc)
        )